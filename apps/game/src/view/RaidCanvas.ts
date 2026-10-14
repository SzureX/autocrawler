import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  Scene,
  Sprite,
  SpriteMaterial,
  WebGLRenderer,
  type Material,
} from 'three';
import type { RaidEvent } from '@loch/sim';
import { gameData } from '../store/gameStore';
import {
  angleDelta,
  cellToWorld,
  clampFocus,
  facingAngle,
  lungeAmount,
  smoothing,
  type Vec2,
} from './layout';
import { RaidPlayback, type Floater, type PlaybackState, type ViewUnit } from './playback';
import { ShapeCache, TextureCache } from './placeholders';
import { RoomStage } from './roomStage';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 680;
const TICK_RATE = 20;
const CAMERA_OFFSET = { y: 7.6, z: 6.8 };
const BAR_WIDTH = 0.8;

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

interface UnitView {
  root: Group;
  body: Group;
  mesh: Mesh;
  material: MeshStandardMaterial;
  baseColor: Color;
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
  private readonly camera = new PerspectiveCamera(45, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 100);
  private readonly board = gameData.balance.combat.board;
  private readonly stage = new RoomStage(this.board);
  private readonly shapes = new ShapeCache();
  private readonly textures = new TextureCache();
  private readonly units: Record<number, UnitView> = {};
  private readonly floaters: Record<number, Sprite> = {};
  private focus: Vec2 = { x: 0, z: 0 };
  private roomKey: string | null = null;
  private playback: RaidPlayback | null = null;
  private speed = 1;
  private paused = false;
  private destroyed = false;
  private lastTime: number | null = null;
  private listeners: ((s: PlaybackState) => void)[] = [];

  constructor(private readonly host: HTMLElement) {
    this.scene.background = new Color(0x14161c);
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
    this.placeCamera();
    renderer.setAnimationLoop((time) => this.frame(time));
  }

  load(log: readonly RaidEvent[]): void {
    this.playback = new RaidPlayback(log);
    this.paused = false;
    this.playback.advanceTo(0);
    this.snapFocus();
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
    this.shapes.dispose();
    this.textures.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    this.renderer = null;
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
    if (pb && !this.paused && !pb.done) {
      pb.advanceTo(pb.tick + dt * TICK_RATE * this.speed);
      advanced = true;
    }
    this.sync(dt, timeMs / 1000);
    if (advanced) this.emit();
    this.renderer?.render(this.scene, this.camera);
  }

  private heroWorld(state: PlaybackState): Vec2 | null {
    const hero = state.units.find((u) => u.id === 0);
    return hero ? cellToWorld(hero.x, hero.y, this.board) : null;
  }

  private snapFocus(): void {
    const state = this.playback?.snapshot();
    const hero = state ? this.heroWorld(state) : null;
    if (hero) this.focus = clampFocus(hero, this.board);
    this.placeCamera();
  }

  private placeCamera(): void {
    this.camera.position.set(this.focus.x, CAMERA_OFFSET.y, this.focus.z + CAMERA_OFFSET.z);
    this.camera.lookAt(this.focus.x, 0.3, this.focus.z);
  }

  /** Brings the 3D scene in line with the playback state (units, floaters, camera). */
  private sync(dt: number, time = 0): void {
    const state = this.playback?.snapshot();
    if (!state) return;
    this.stage.setTheme(state.roomTypeId);
    if (state.roomKey !== this.roomKey) {
      this.roomKey = state.roomKey;
      this.snapFocus();
    }

    const alive: Record<number, boolean> = {};
    for (const u of state.units) {
      alive[u.id] = true;
      this.updateUnit(this.units[u.id] ?? this.createUnit(u), u, state.tick, dt, time);
    }
    for (const [id, view] of Object.entries(this.units)) {
      if (alive[Number(id)]) continue;
      this.scene.remove(view.root);
      view.material.dispose();
      view.label.material.dispose();
      view.hpBack.material.dispose();
      view.hpFill.material.dispose();
      delete this.units[Number(id)];
    }

    this.syncFloaters(state);

    const hero = this.heroWorld(state);
    if (hero) {
      const goal = clampFocus(hero, this.board);
      const k = smoothing(dt);
      this.focus = {
        x: this.focus.x + (goal.x - this.focus.x) * k,
        z: this.focus.z + (goal.z - this.focus.z) * k,
      };
    }
    this.placeCamera();
  }

  private createUnit(u: ViewUnit): UnitView {
    const shape = this.shapes.get(u.monsterId);
    const baseColor = new Color(
      u.id === 0 ? COLORS.hero : u.boss ? COLORS.boss : u.elite ? COLORS.elite : COLORS.monster,
    );
    const material = new MeshStandardMaterial({ color: baseColor, roughness: 0.6 });
    const mesh = new Mesh(shape.geometry, material);
    mesh.position.y = shape.height / 2;
    mesh.castShadow = true;
    const scale = u.elite ? 1.2 : 1;
    mesh.scale.setScalar(scale);
    const body = new Group();
    body.add(mesh);
    const root = new Group();
    root.add(body);

    const labelMat = new SpriteMaterial({
      map: this.textures.get(icon(u.monsterId), 90),
      depthTest: false,
    });
    const label = new Sprite(labelMat);
    label.scale.set(1.1, 0.55, 1);
    label.position.y = shape.height * scale + 0.55;
    label.renderOrder = 12;
    const hpBack = new Sprite(new SpriteMaterial({ color: COLORS.hpBack, depthTest: false }));
    const hpFill = new Sprite(new SpriteMaterial({ color: COLORS.hpFill, depthTest: false }));
    for (const [bar, order] of [
      [hpBack, 10],
      [hpFill, 11],
    ] as const) {
      bar.center.set(0, 0.5);
      bar.position.set(-BAR_WIDTH / 2, shape.height * scale + 0.2, 0);
      bar.renderOrder = order;
    }
    hpBack.scale.set(BAR_WIDTH, 0.11, 1);
    root.add(label, hpBack, hpFill);
    this.scene.add(root);

    const w = cellToWorld(u.x, u.y, this.board);
    const view: UnitView = {
      root,
      body,
      mesh,
      material,
      baseColor,
      label,
      hpBack,
      hpFill,
      height: shape.height,
      lastX: w.x,
      lastZ: w.z,
      angle: 0,
      moving: 0,
    };
    this.units[u.id] = view;
    return view;
  }

  private updateUnit(view: UnitView, u: ViewUnit, tick: number, dt: number, time: number): void {
    const w = cellToWorld(u.x, u.y, this.board);
    view.root.position.set(w.x, 0, w.z);
    const dx = w.x - view.lastX;
    const dz = w.z - view.lastZ;
    if (Math.hypot(dx, dz) > 1e-4) {
      view.angle +=
        angleDelta(view.angle, facingAngle(dx, dz)) * Math.max(smoothing(dt, 14), dt === 0 ? 1 : 0);
      view.moving = 1;
    } else {
      view.moving = Math.max(0, view.moving - dt * 6);
    }
    view.lastX = w.x;
    view.lastZ = w.z;
    view.body.rotation.y = view.angle;
    view.mesh.position.z = lungeAmount(tick - u.attackTick);
    view.mesh.position.y = view.height / 2 + Math.abs(Math.sin(time * 11)) * 0.06 * view.moving;

    const flash = tick - u.hitTick < 3;
    view.material.color.copy(flash ? new Color(0xffffff) : view.baseColor);
    const frac = Math.max(0, Math.min(1, u.hp / u.maxHp));
    view.hpFill.scale.set(Math.max(0.001, BAR_WIDTH * frac), 0.11, 1);
    view.hpFill.material.color.setHex(frac < 0.3 ? COLORS.hpLow : COLORS.hpFill);
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
