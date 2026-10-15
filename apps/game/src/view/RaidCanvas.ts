import {
  AnimationMixer,
  Color,
  LoopOnce,
  type AnimationAction,
  Group,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
  type Material,
} from 'three';
import type { Dir, RaidEvent } from '@loch/sim';
import { gameData } from '../store/gameStore';
import { angleDelta, cellToWorld, facingAngle, lungeAmount, smoothing, type Vec2 } from './layout';
import {
  RaidPlayback,
  type Floater,
  type PlaybackState,
  type ViewChest,
  type ViewUnit,
} from './playback';
import { builderFiles, propFiles } from './builderCatalog';
import { sharedModels } from './models';
import { RAID_FOV, RAID_LOOK_HEIGHT, wholeRoomFrame } from './cameraFrame';
import { FOG_BACKGROUND, MapFog } from './mapFog';
import { roomRect } from './mapLayout';
import { reducedMotion } from './motion';
import { ShapeCache, TextureCache } from './placeholders';
import { RoomStage } from './roomStage';
import { MODEL_SCALE } from './wallLayout';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 680;
const TICK_RATE = 20;
const BAR_WIDTH = 0.8;
/** Moving on to the next room: the picture slides and fades out, then in (seconds per half). */
const TRANSITION_SECONDS = 0.22;
const TRANSITION_PX = 70;
/** A door opens when the hero is this close (in cells) and shuts when he walks away. */
const DOOR_OPEN_DISTANCE = 2.4;
/** A door stays open this close to it while the hero walks in (it shuts behind him). */
const DOOR_CROSSING_DISTANCE = 1.2;
/** Switch for the door-opening animation (an experiment; off leaves the doorways as they are). */
const ANIMATE_DOORS = true;
/** Screen direction the picture slides in when the hero leaves through a door on that side. */
const SLIDE: Record<Dir, { x: number; y: number }> = {
  E: { x: -1, y: 0 },
  W: { x: 1, y: 0 },
  N: { x: 0, y: 1 },
  S: { x: 0, y: -1 },
};

interface Transition {
  phase: 'out' | 'in';
  t: number;
  dir: Dir;
  /** Tick of the room change that waits until the picture has faded out. */
  enterTick: number;
}
/** Clip played for each animation state (names from the Rig_Medium packs). */
const CLIPS = {
  idle: 'Idle_A',
  move: 'Walking_B',
  attack: 'Throw',
  death: 'Death_A',
} as const;
type AnimState = keyof typeof CLIPS;
const FADE = 0.15;
/** The chest lid: hinge on the back edge of the base (model units) and how far it swings up. */
const LID_HINGE = { y: 0.6, z: -0.65 };
const LID_OPEN_ANGLE = 1.9;
const LID_OPEN_TICKS = 10;
/** Game-time seconds a hit reaction lasts / a dying unit stays on screen. */
const ATTACK_SECONDS = 0.5;
const DEATH_SECONDS = 1.3;
/** Height of a unit model on the board (cells are 1 unit; the hero capsule is about 1.05). */
const MODEL_UNIT_HEIGHT = 1.15;

const COLORS = {
  hero: 0x4caf70,
  monster: 0xc75c5c,
  elite: 0xe08a3c,
  boss: 0x9a4cc7,
  hpFill: 0x5fd38a,
  hpLow: 0xe05252,
  hpBack: 0x2a1515,
};

const FLOATER_COLORS: Record<string, string> = {
  damage: '#ffffff',
  crit: '#ffd24a',
  heal: '#5fd38a',
  miss: '#9aa6bf',
  trap: '#ff9a4a',
  loot: '#ffffff',
};

function icon(monsterId: string): string {
  if (monsterId === 'hero') return '🧙';
  return gameData.monsters[monsterId]?.icon ?? gameData.bosses[monsterId]?.icon ?? '?';
}

interface ChestView {
  root: Group;
  closedBase: Object3D;
  goldBase: Object3D;
  lid: Group;
  x: number;
  y: number;
}

interface UnitView {
  root: Group;
  body: Group;
  /** The visible model or placeholder; lunges and bobs relative to `baseY`. */
  visual: Object3D;
  baseY: number;
  materials: MeshStandardMaterial[];
  baseColor: Color;
  flash: (on: boolean) => void;
  mixer: AnimationMixer | null;
  actions: Partial<Record<AnimState, AnimationAction>>;
  anim: AnimState | null;
  lastAttackTick: number;
  /** True from an attack until the unit moves again: it stays turned to its target. */
  facingTarget: boolean;
  seenAttackTick: number;
  attackLeft: number;
  label: Sprite;
  hpBack: Sprite;
  hpFill: Sprite;
  height: number;
  lastX: number;
  lastZ: number;
  angle: number;
  moving: number;
}

/** Three.js view that replays a raid log. All combat numbers come from the log. */
export class RaidCanvas {
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(RAID_FOV, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 100);
  private readonly board = gameData.balance.combat.board;
  private readonly stage = new RoomStage(this.board);
  private readonly shapes = new ShapeCache();
  private readonly models = sharedModels;
  private readonly textures = new TextureCache();
  private readonly units: Record<number, UnitView> = {};
  private readonly floaters: Record<number, Sprite> = {};
  private chestView: ChestView | null = null;
  /** Units that died and are still playing their death animation. */
  private dying: { view: UnitView; left: number }[] = [];
  /** The camera never follows the hero: it always shows the whole room. */
  private readonly frameDistance = wholeRoomFrame(this.board, VIEW_WIDTH / VIEW_HEIGHT);
  private roomKey: string | null = null;
  private playback: RaidPlayback | null = null;
  private speed = 1;
  private paused = false;
  private destroyed = false;
  /** Skip pressed before the log was loaded (models may still be loading): applied on load. */
  private skipRequested = false;
  private lastTime: number | null = null;
  private listeners: ((s: PlaybackState) => void)[] = [];
  private readonly fog: MapFog;
  private trans: Transition | null = null;
  private readonly doorOpen: Record<Dir, number> = { N: 0, E: 0, S: 0, W: 0 };

  constructor(private readonly host: HTMLElement) {
    // The same fog as on the dungeon map, so the room stays wrapped in it through the raid.
    this.scene.background = new Color(FOG_BACKGROUND);
    this.fog = new MapFog({ x: 0, z: 0 }, { x: 90, z: 70 });
    this.fog.setRooms([{ rect: roomRect('0,0', this.board), weight: 1 }]);
    this.scene.add(this.fog.group);
    this.scene.add(this.stage.group);
  }

  /** Creates the WebGL renderer and starts the render loop. */
  async init(): Promise<void> {
    if (this.destroyed) return;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setSize(VIEW_WIDTH, VIEW_HEIGHT);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFSoftShadowMap;
    this.host.appendChild(renderer.domElement);
    this.renderer = renderer;
    // Models are optional: anything that fails to load keeps its placeholder.
    await this.models.load();
    if (this.destroyed) return;
    // Layout floors and props (many possible files) are registered now and loaded when needed.
    this.models.register({ ...builderFiles(), ...propFiles() });
    this.stage.applyModels(this.models);
    this.placeCamera();
    renderer.setAnimationLoop((time) => this.frame(time));
  }

  load(log: readonly RaidEvent[]): void {
    for (const d of this.dying) this.disposeUnit(d.view);
    this.dying = [];
    this.playback = new RaidPlayback(log);
    this.paused = false;
    this.playback.advanceTo(0);
    if (this.skipRequested) this.playback.skipToEnd();
    this.skipRequested = false;
    this.placeCamera();
    this.sync(0);
    this.emit();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  skip(): void {
    this.skipRequested = true;
    this.endTransition();
    this.playback?.skipToEnd();
    this.sync(0);
    this.emit();
  }

  onState(cb: (s: PlaybackState) => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.listeners = [];
    const renderer = this.renderer;
    if (!renderer) return;
    renderer.setAnimationLoop(null);
    this.scene.traverse((o) => {
      const obj = o as Mesh;
      obj.geometry?.dispose();
      const m = obj.material as Material | Material[] | undefined;
      if (Array.isArray(m)) m.forEach((x) => x.dispose());
      else m?.dispose();
    });
    this.fog.dispose();
    this.shapes.dispose();
    this.textures.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    this.renderer = null;
  }

  /** Doorways follow the room's doors; its layout (floors, props) replaces the default look. */
  private showRoom(doors: PlaybackState['doors'], layoutId: string | null): void {
    this.stage.setDoors(doors);
    const layout = layoutId ? (gameData.roomLayouts[layoutId] ?? null) : null;
    if (!layout) {
      this.stage.setLayout(null);
      return;
    }
    if (this.stage.canShow(layout)) {
      this.stage.setLayout(layout);
      return;
    }
    this.stage.setLayout(null);
    const room = this.roomKey;
    const keys = [
      ...layout.floors.map((f) => `floor:${f.id}`),
      ...layout.props.map((p) => `prop:${p.id}`),
    ];
    void this.models.load(keys, { animations: false }).then(() => {
      if (this.roomKey === room && !this.destroyed) this.stage.setLayout(layout);
    });
  }

  private emit(): void {
    if (!this.playback) return;
    const s = this.playback.snapshot();
    for (const l of this.listeners) l(s);
  }

  private frame(timeMs: number): void {
    const dt = this.lastTime === null ? 0 : Math.min(0.1, (timeMs - this.lastTime) / 1000);
    this.lastTime = timeMs;
    const pb = this.playback;
    let advanced = false;
    if (pb && !this.paused) {
      if (this.trans) {
        this.runTransition(dt, pb);
        advanced = true;
      } else if (!pb.done) {
        const target = pb.tick + dt * TICK_RATE * this.speed;
        const next = this.roomKey !== null && !reducedMotion() ? pb.nextRoomEnter() : null;
        if (next && next.tick <= target) {
          // Stop right before the room change; it happens while the picture is faded out.
          pb.advanceTo(next.tick - 0.001);
          this.trans = { phase: 'out', t: 0, dir: next.from ?? 'E', enterTick: next.tick };
        } else pb.advanceTo(target);
        advanced = true;
      }
    }
    this.fog.setTime(reducedMotion() ? 0 : timeMs / 1000);
    this.sync(dt, timeMs / 1000);
    if (advanced) this.emit();
    this.renderer?.render(this.scene, this.camera);
  }

  /** Slides and fades the picture out, changes the room, then slides and fades it in. */
  private runTransition(dt: number, pb: RaidPlayback): void {
    const tr = this.trans;
    const canvas = this.renderer?.domElement;
    if (!tr || !canvas) return;
    tr.t += dt / (TRANSITION_SECONDS / Math.min(this.speed, 2));
    const k = Math.min(1, tr.t);
    const ease = k * k * (3 - 2 * k);
    const slide = SLIDE[tr.dir];
    if (tr.phase === 'out') {
      canvas.style.opacity = String(1 - ease);
      canvas.style.transform = `translate(${slide.x * ease * TRANSITION_PX}px, ${slide.y * ease * TRANSITION_PX}px)`;
      if (tr.t >= 1) {
        pb.advanceTo(tr.enterTick);
        tr.phase = 'in';
        tr.t = 0;
      }
      return;
    }
    canvas.style.opacity = String(ease);
    canvas.style.transform = `translate(${-slide.x * (1 - ease) * TRANSITION_PX}px, ${-slide.y * (1 - ease) * TRANSITION_PX}px)`;
    if (tr.t >= 1) this.endTransition();
  }

  private endTransition(): void {
    this.trans = null;
    const canvas = this.renderer?.domElement;
    if (canvas) {
      canvas.style.opacity = '';
      canvas.style.transform = '';
    }
  }

  /** A picture of the current frame (used to blend into the next screen). */
  snapshot(): string | null {
    const renderer = this.renderer;
    if (!renderer) return null;
    renderer.render(this.scene, this.camera);
    return renderer.domElement.toDataURL('image/jpeg', 0.85);
  }

  /** Key of the room being shown (null before the raid is loaded). */
  currentRoomKey(): string | null {
    return this.roomKey;
  }

  private placeCamera(): void {
    const f = this.frameDistance;
    this.camera.position.set(0, f.height, f.back);
    this.camera.lookAt(0, RAID_LOOK_HEIGHT, 0);
  }

  /** Brings the 3D scene in line with the playback state (units, floaters, camera). */
  private sync(dt: number, time = 0): void {
    const state = this.playback?.snapshot();
    if (!state) return;
    this.stage.setTheme(state.roomTypeId);
    const roomChanged = state.roomKey !== this.roomKey;
    if (roomChanged) {
      this.roomKey = state.roomKey;
      this.showRoom(state.doors, state.layoutId);
    }

    const alive: Record<number, boolean> = {};
    const byId: Record<number, ViewUnit> = {};
    for (const u of state.units) byId[u.id] = u;
    for (const u of state.units) {
      alive[u.id] = true;
      const faceChest =
        u.id === 0 && state.chest && state.chest.openedTick !== null
          ? cellToWorld(state.chest.x, state.chest.y, this.board)
          : null;
      const target = u.attackTarget === null ? undefined : byId[u.attackTarget];
      const faceTarget = cellToWorld(
        target ? target.x : u.targetX,
        target ? target.y : u.targetY,
        this.board,
      );
      this.updateUnit(
        this.units[u.id] ?? this.createUnit(u),
        u,
        state.tick,
        dt,
        time,
        faceChest,
        u.attackTarget === null ? null : faceTarget,
      );
    }
    for (const [id, view] of Object.entries(this.units)) {
      if (alive[Number(id)]) continue;
      delete this.units[Number(id)];
      if (dt > 0 && view.mixer && view.actions.death) {
        view.label.visible = false;
        view.hpBack.visible = false;
        view.hpFill.visible = false;
        this.fadeTo(view, 'death');
        this.dying.push({ view, left: DEATH_SECONDS });
      } else this.disposeUnit(view);
    }
    this.dying = this.dying.filter((d) => {
      const step = dt * this.speed;
      d.view.mixer?.update(step);
      d.left -= step;
      if (d.left > 0) return true;
      this.disposeUnit(d.view);
      return false;
    });

    this.syncDoors(state, dt, roomChanged);
    this.syncChest(state.chest, state.tick);
    this.syncFloaters(state);

    this.placeCamera();
  }

  /** Doors swing open while the hero is near them (also when he is still outside). */
  private syncDoors(state: PlaybackState, dt: number, snap: boolean): void {
    const hero = state.units.find((u) => u.id === 0);
    if (!ANIMATE_DOORS || !hero) return;
    const { width, height } = this.board;
    const cx = Math.floor(width / 2);
    const cy = Math.floor(height / 2);
    const doors: Record<Dir, { x: number; y: number }> = {
      N: { x: cx, y: 0 },
      S: { x: cx, y: height - 1 },
      W: { x: 0, y: cy },
      E: { x: width - 1, y: cy },
    };
    const outside = hero.x < 0 || hero.y < 0 || hero.x > width - 1 || hero.y > height - 1;
    for (const side of state.doors) {
      const d = doors[side];
      const dist = Math.hypot(hero.x - d.x, hero.y - d.y);
      // Open while the hero crosses the doorway; shut behind him once he is inside and fighting,
      // open again when the room is cleared and he walks to the exit.
      const crossing = outside || dist < DOOR_CROSSING_DISTANCE;
      const goal = state.cleared ? (dist < DOOR_OPEN_DISTANCE ? 1 : 0) : crossing ? 1 : 0;
      this.doorOpen[side] = snap
        ? 0
        : this.doorOpen[side] + (goal - this.doorOpen[side]) * smoothing(dt, 9);
      this.stage.setDoorOpen(side, this.doorOpen[side]);
    }
  }

  private disposeUnit(view: UnitView): void {
    this.scene.remove(view.root);
    view.mixer?.stopAllAction();
    view.materials.forEach((m) => m.dispose());
    view.label.material.dispose();
    view.hpBack.material.dispose();
    view.hpFill.material.dispose();
  }

  /** Cross-fades a unit to an animation state (no-op when already there or the clip is missing). */
  private fadeTo(view: UnitView, state: AnimState): void {
    if (view.anim === state) return;
    const next = view.actions[state];
    if (!next) return;
    const prev = view.anim ? view.actions[view.anim] : undefined;
    next.reset().setEffectiveWeight(1).fadeIn(FADE).play();
    prev?.fadeOut(FADE);
    view.anim = state;
  }

  /** Idle / walk loops plus one-shot attack and death clips (getting hit only flashes the model). */
  private animate(view: UnitView, u: ViewUnit, tick: number, dt: number): void {
    const mixer = view.mixer;
    if (!mixer) return;
    const sinceAttack = tick - u.attackTick;
    if (u.attackTick !== view.lastAttackTick && sinceAttack >= 0 && sinceAttack < 3) {
      view.lastAttackTick = u.attackTick;
      view.attackLeft = ATTACK_SECONDS;
      this.fadeTo(view, 'attack');
    }
    const step = dt * this.speed;
    if (view.attackLeft > 0) view.attackLeft -= step;
    if (view.attackLeft <= 0) this.fadeTo(view, view.moving > 0.5 ? 'move' : 'idle');
    mixer.update(step);
  }

  private createUnit(u: ViewUnit): UnitView {
    const scale = u.elite ? 1.2 : 1;
    const baseColor = new Color(
      u.id === 0 ? COLORS.hero : u.boss ? COLORS.boss : u.elite ? COLORS.elite : COLORS.monster,
    );
    const modelId = u.id === 0 ? 'hero' : u.monsterId;
    const model = this.models.create(modelId);
    let visual: Object3D;
    let baseY: number;
    let height: number;
    let materials: MeshStandardMaterial[];
    let flash: (on: boolean) => void;
    let mixer: AnimationMixer | null = null;
    const actions: Partial<Record<AnimState, AnimationAction>> = {};
    if (model) {
      // Models are authored about 2.5 units tall; the board cell is 1 unit.
      const fit = MODEL_UNIT_HEIGHT / this.models.height(modelId);
      model.scale.setScalar(fit * scale);
      visual = model;
      baseY = 0;
      height = MODEL_UNIT_HEIGHT * scale;
      this.models.attachWeapon(model, modelId);
      mixer = new AnimationMixer(model);
      for (const state of Object.keys(CLIPS) as AnimState[]) {
        const clip = this.models.clip(CLIPS[state]);
        if (!clip) continue;
        const action = mixer.clipAction(clip);
        if (state !== 'idle' && state !== 'move') {
          action.setLoop(LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        actions[state] = action;
      }
      materials = [];
      model.traverse((o) => {
        const m = (o as Mesh).material as MeshStandardMaterial | undefined;
        if (m?.isMeshStandardMaterial) materials.push(m);
      });
      flash = (on) => {
        for (const m of materials) {
          m.emissive.setHex(on ? 0xffffff : 0x000000);
          m.emissiveIntensity = on ? 0.3 : 0;
        }
      };
    } else {
      const shape = this.shapes.get(u.monsterId);
      const material = new MeshStandardMaterial({ color: baseColor, roughness: 0.6 });
      const mesh = new Mesh(shape.geometry, material);
      mesh.castShadow = true;
      mesh.scale.setScalar(scale);
      visual = mesh;
      baseY = shape.height / 2;
      height = shape.height * scale;
      materials = [material];
      flash = (on) => material.color.copy(on ? new Color(0xffffff) : baseColor);
    }
    visual.position.y = baseY;
    const body = new Group();
    body.add(visual);
    const root = new Group();
    root.add(body);

    const labelMat = new SpriteMaterial({
      map: this.textures.get(icon(u.monsterId), 90),
      depthTest: false,
    });
    const label = new Sprite(labelMat);
    label.scale.set(1.1, 0.55, 1);
    label.position.y = height + 0.55;
    label.renderOrder = 12;
    const hpBack = new Sprite(new SpriteMaterial({ color: COLORS.hpBack, depthTest: false }));
    const hpFill = new Sprite(new SpriteMaterial({ color: COLORS.hpFill, depthTest: false }));
    for (const [bar, order] of [
      [hpBack, 10],
      [hpFill, 11],
    ] as const) {
      bar.center.set(0, 0.5);
      bar.position.set(-BAR_WIDTH / 2, height + 0.2, 0);
      bar.renderOrder = order;
    }
    hpBack.scale.set(BAR_WIDTH, 0.11, 1);
    root.add(label, hpBack, hpFill);
    this.scene.add(root);

    const w = cellToWorld(u.x, u.y, this.board);
    const view: UnitView = {
      root,
      body,
      visual,
      baseY,
      materials,
      baseColor,
      flash,
      mixer,
      actions,
      anim: null,
      lastAttackTick: -1,
      facingTarget: false,
      seenAttackTick: -1,
      attackLeft: 0,
      label,
      hpBack,
      hpFill,
      height,
      lastX: w.x,
      lastZ: w.z,
      angle: 0,
      moving: 0,
    };
    this.units[u.id] = view;
    return view;
  }

  private updateUnit(
    view: UnitView,
    u: ViewUnit,
    tick: number,
    dt: number,
    time: number,
    faceChest: Vec2 | null,
    faceTarget: Vec2 | null,
  ): void {
    const w = cellToWorld(u.x, u.y, this.board);
    view.root.position.set(w.x, 0, w.z);
    const dx = w.x - view.lastX;
    const dz = w.z - view.lastZ;
    if (Math.hypot(dx, dz) > 1e-4) {
      view.angle +=
        angleDelta(view.angle, facingAngle(dx, dz)) * Math.max(smoothing(dt, 14), dt === 0 ? 1 : 0);
      view.moving = 1;
      view.facingTarget = false;
    } else {
      view.moving = Math.max(0, view.moving - dt * 6);
      if (u.attackTick !== view.seenAttackTick) {
        view.seenAttackTick = u.attackTick;
        if (faceTarget && u.attackTick >= 0) view.facingTarget = true;
      }
      if (view.facingTarget && faceTarget) {
        // Attacking: stay turned to whatever was attacked.
        const target = facingAngle(faceTarget.x - w.x, faceTarget.z - w.z);
        view.angle +=
          angleDelta(view.angle, target) * Math.max(smoothing(dt, 14), dt === 0 ? 1 : 0);
      } else if (faceChest) {
        // Standing in front of the chest: turn to face it.
        const target = facingAngle(faceChest.x - w.x, faceChest.z - w.z);
        view.angle +=
          angleDelta(view.angle, target) * Math.max(smoothing(dt, 10), dt === 0 ? 1 : 0);
      }
    }
    view.lastX = w.x;
    view.lastZ = w.z;
    view.body.rotation.y = view.angle;
    // Models play their attack clip; only placeholder shapes lunge.
    view.visual.position.z = view.mixer ? 0 : lungeAmount(tick - u.attackTick);
    view.visual.position.y =
      view.baseY + (view.mixer ? 0 : Math.abs(Math.sin(time * 11)) * 0.06 * view.moving);

    this.animate(view, u, tick, dt);
    view.flash(tick - u.hitTick < 3);
    const frac = Math.max(0, Math.min(1, u.hp / u.maxHp));
    view.hpFill.scale.set(Math.max(0.001, BAR_WIDTH * frac), 0.11, 1);
    view.hpFill.material.color.setHex(frac < 0.3 ? COLORS.hpLow : COLORS.hpFill);
  }

  /** The room's chest: a closed one while the hero walks up, the lid swings open with the log. */
  private syncChest(chest: ViewChest | null, tick: number): void {
    if (!chest) {
      if (this.chestView) {
        this.scene.remove(this.chestView.root);
        this.chestView = null;
      }
      return;
    }
    if (!this.chestView || this.chestView.x !== chest.x || this.chestView.y !== chest.y) {
      if (this.chestView) this.scene.remove(this.chestView.root);
      this.chestView = this.createChest(chest);
    }
    const view = this.chestView;
    if (!view) return;
    const t =
      chest.openedTick === null
        ? 0
        : Math.min(1, Math.max(0, (tick - chest.openedTick) / LID_OPEN_TICKS));
    view.lid.rotation.x = -LID_OPEN_ANGLE * (1 - (1 - t) * (1 - t));
    // Once the lid is going up the inside is full of gold.
    view.goldBase.visible = t > 0;
    view.closedBase.visible = t === 0;
  }

  private createChest(chest: ViewChest): ChestView | null {
    const base = this.models.create('prop:chest', false);
    const gold = this.models.create('prop:chest_gold', false);
    const lidModel = this.models.create('prop:chest_lid', false);
    if (!base || !gold || !lidModel) return null;
    const root = new Group();
    const lid = new Group();
    lid.position.set(0, LID_HINGE.y, LID_HINGE.z);
    lidModel.position.set(0, -LID_HINGE.y, -LID_HINGE.z);
    lid.add(lidModel);
    gold.visible = false;
    root.add(base, gold, lid);
    // The chest faces south (+z), towards the camera and the cell the hero stands on.
    const p = cellToWorld(chest.x, chest.y, this.board);
    root.scale.setScalar(MODEL_SCALE);
    root.position.set(p.x, 0.03, p.z);
    this.scene.add(root);
    return { root, closedBase: base, goldBase: gold, lid, x: chest.x, y: chest.y };
  }

  private syncFloaters(state: PlaybackState): void {
    const live: Record<number, boolean> = {};
    for (const f of state.floaters) {
      live[f.id] = true;
      const sprite = this.floaters[f.id] ?? this.createFloater(f);
      const age = state.tick - f.tick;
      const p = cellToWorld(f.x, f.y, this.board);
      sprite.position.set(p.x, 1.7 + age * 0.05, p.z);
      sprite.material.opacity = Math.max(0, 1 - age / 24);
    }
    for (const [id, sprite] of Object.entries(this.floaters)) {
      if (live[Number(id)]) continue;
      this.scene.remove(sprite);
      sprite.material.dispose();
      delete this.floaters[Number(id)];
    }
  }

  private createFloater(f: Floater): Sprite {
    const px = f.kind === 'crit' ? 100 : 80;
    const map = this.textures.get(f.text, px, FLOATER_COLORS[f.kind] ?? '#ffffff');
    const sprite = new Sprite(new SpriteMaterial({ map, transparent: true, depthTest: false }));
    sprite.scale.set(f.kind === 'crit' ? 1.6 : 1.2, f.kind === 'crit' ? 0.8 : 0.6, 1);
    sprite.renderOrder = 20;
    this.scene.add(sprite);
    this.floaters[f.id] = sprite;
    return sprite;
  }
}
