import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  Vector3,
  WebGLRenderer,
} from 'three';
import type { RoomInstance, RoomTile } from '@loch/sim';
import { gameData } from '../store/gameStore';
import { builderFiles, propFiles } from './builderCatalog';
import { sharedModels } from './models';
import { WALL_HEIGHT, mapBounds, parseKey, roomPitch, roomRect, roomWorld } from './mapLayout';
import { MapFog } from './mapFog';
import { RAID_DISTANCE, RAID_FOV, RAID_LOOK_HEIGHT, RAID_START_FOCUS } from './cameraFrame';
import { reducedMotion } from './motion';
import { RoomStage } from './roomStage';
import { showRoom, type RoomLook } from './roomShow';

/** The map is seen from the raid's angle, turned a little to the left. */
const PITCH_DEG = 48;
const YAW_DEG = 30;
const FOV = 40;
const FLIGHT_SECONDS = 1.5;
const RISE_PART = 0.32;
const DROP_IN_SECONDS = 0.45;
const SHAKE_SECONDS = 0.55;
const SHAKE_SIZE = 0.35;
const CAMERA_SPEED = 3.2;
/** Slower, for the trip between the map and a room. */
const TRIP_SPEED = 2.4;
const TRIP_MAX_SECONDS = 2.4;
/** Matches the far fog, so the map blends into it at the edges. */
const BACKGROUND = 0x7c828b;

export interface CellRect {
  left: number;
  top: number;
  width: number;
  height: number;
  /** Outline of the room on screen, in pixels relative to `left`/`top`. */
  polygon: [number, number][];
}

interface Flight {
  key: string;
  stage: RoomStage;
  from: Vector3;
  to: Vector3;
  t: number;
  /** Frame time (ms) when the flight began; it follows the clock, not the frame count. */
  startMs: number | null;
  resolve: () => void;
}

interface Effect {
  update: (dt: number) => boolean;
  dispose: () => void;
}

type Pt = { x: number; y: number };

/** Outline of a set of screen points (Andrew's monotone chain). */
function convexHull(points: Pt[]): Pt[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const build = (list: Pt[]): Pt[] => {
    const hull: Pt[] = [];
    for (const p of list) {
      while (hull.length >= 2) {
        const a = hull[hull.length - 2];
        const b = hull[hull.length - 1];
        if (a && b && cross(a, b, p) <= 0) hull.pop();
        else break;
      }
      hull.push(p);
    }
    hull.pop();
    return hull;
  };
  return [...build(sorted), ...build([...sorted].reverse())];
}

/**
 * Three.js view of the dungeon being built: every room is the same 3D room the raid plays in,
 * neighbours share their wall and doorways, and undiscovered cells lie under a thin fog. The
 * camera looks from the raid's angle and always frames the whole dungeon. A chosen tile can fly in
 * from a screen position and land with a thud.
 */
export class DungeonMapCanvas {
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly board = gameData.balance.combat.board;
  private readonly grid = gameData.balance.grid;
  private readonly pitch = roomPitch(this.board);
  private readonly models = sharedModels;
  private readonly rooms: Record<string, RoomStage> = {};
  private want: Record<string, RoomInstance> = {};
  private readonly marks = new Group();
  private readonly fog: MapFog;
  private readonly highlight = new MeshBasicMaterial({
    color: 0x4caf70,
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
  });
  private readonly markGeometry = new PlaneGeometry(
    this.pitch.x * 0.96,
    this.pitch.z * 0.96,
  ).rotateX(-Math.PI / 2);
  private marksKey = '';
  private legal: string[] = [];
  private extra: string[] = [];
  private flight: Flight | null = null;
  private effects: Effect[] = [];
  private readonly focus = new Vector3();
  private readonly goalFocus = new Vector3();
  private distance = 40;
  private goalDistance = 40;
  private yaw = YAW_DEG;
  private goalYaw = YAW_DEG;
  private fov = FOV;
  private goalFov = FOV;
  /** 'close': the camera sits in one room and the rest of the dungeon is fogged over. */
  private mode: 'overview' | 'close' = 'overview';
  private closeKey: string | null = null;
  private readonly weights: Record<string, number> = {};
  private trip: { startMs: number | null; resolve: () => void } | null = null;
  private weightsMoved = false;
  private shake = 0;
  private ready = false;
  private known = false;
  private destroyed = false;
  private lastTime: number | null = null;
  private cameraListener: (() => void) | null = null;
  private time = 0;
  private dirty = true;
  private lastRender = 0;

  constructor(
    private readonly host: HTMLElement,
    private readonly width: number,
    private readonly height: number,
  ) {
    this.camera = new PerspectiveCamera(FOV, width / height, 0.5, 600);
    this.scene.background = new Color(BACKGROUND);
    this.scene.add(new AmbientLight(0xffffff, 1.1));
    const sun = new DirectionalLight(0xffffff, 2.2);
    sun.position.set(40, 90, 55);
    this.scene.add(sun);
    const centre = roomWorld((this.grid.width - 1) / 2, (this.grid.height - 1) / 2, this.board);
    this.fog = new MapFog(centre, {
      x: (this.grid.width + 8) * this.pitch.x,
      z: (this.grid.height + 8) * this.pitch.z,
    });
    this.scene.add(this.fog.group, this.marks);
  }

  async init(): Promise<void> {
    if (this.destroyed) return;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setSize(this.width, this.height);
    this.host.appendChild(renderer.domElement);
    this.renderer = renderer;
    await this.models.load();
    if (this.destroyed) return;
    this.models.register({ ...builderFiles(), ...propFiles() });
    this.ready = true;
    this.sync();
    renderer.setAnimationLoop((time) => this.frame(time));
  }

  /** Called whenever the camera moved, so the DOM layer can follow. */
  onCamera(listener: (() => void) | null): void {
    this.cameraListener = listener;
  }

  /** Shows these rooms; a room that appears later lands with a thud (unless it flew in). */
  setRooms(rooms: Record<string, RoomInstance>): void {
    this.want = rooms;
    // Rooms are only built once the models are registered (see `init`).
    if (this.ready) this.sync();
  }

  private sync(): void {
    const rooms = this.want;
    const keys = Object.keys(rooms);
    for (const key of keys) {
      const room = rooms[key];
      if (!room || this.rooms[key]) continue;
      if (this.flight?.key === key) {
        this.rooms[key] = this.flight.stage;
        this.flight = null;
        continue;
      }
      const look: RoomLook = {
        roomTypeId: room.roomTypeId,
        doors: room.doors,
        layoutId: room.layoutId,
      };
      const stage = this.buildStage(key, look);
      this.rooms[key] = stage;
      if (this.known) this.dropIn(key, stage);
    }
    for (const key of Object.keys(this.rooms)) {
      if (rooms[key]) continue;
      const stage = this.rooms[key];
      if (stage) this.scene.remove(stage.group);
      delete this.rooms[key];
    }
    this.dirty = true;
    const first = !this.known;
    this.known = true;
    this.extra = this.flight ? [this.flight.key] : [];
    this.rebuildFog();
    this.refit(first);
  }

  /** Cells to mark as places where the tile in hand can be built. */
  setLegal(keys: string[]): void {
    this.legal = keys;
    this.dirty = true;
    this.rebuildFog();
    this.refit();
  }

  /** Screen rectangle and outline of the cell, in canvas pixels. */
  cellRect(key: string): CellRect {
    const p = parseKey(key);
    const c = roomWorld(p.x, p.y, this.board);
    const hx = this.pitch.x / 2;
    const hz = this.pitch.z / 2;
    const corners: [number, number, number][] = [];
    for (const y of [0, WALL_HEIGHT]) {
      for (const [sx, sz] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ] as const) {
        corners.push([c.x + sx * hx, y, c.z + sz * hz]);
      }
    }
    const pts = convexHull(corners.map(([x, y, z]) => this.toScreen(new Vector3(x, y, z))));
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    const left = Math.min(...xs);
    const top = Math.min(...ys);
    return {
      left,
      top,
      width: Math.max(...xs) - left,
      height: Math.max(...ys) - top,
      polygon: pts.map((q) => [q.x - left, q.y - top]),
    };
  }

  /**
   * Flies a room in from a screen position (the card it was chosen from) to its cell; resolves
   * when it lands. `setRooms` takes the flying room over as soon as the dungeon has it.
   */
  flyTile(tile: RoomTile, targetKey: string, from: { x: number; y: number }): Promise<void> {
    if (!this.ready) return Promise.resolve();
    const look: RoomLook = {
      roomTypeId: tile.roomTypeId,
      doors: tile.doors,
      layoutId: tile.layoutId,
    };
    const stage = this.buildStage(targetKey, look);
    const p = parseKey(targetKey);
    const target = roomWorld(p.x, p.y, this.board);
    const to = new Vector3(target.x, 0, target.z);
    // Start on the plane above the map that the card's screen position looks at.
    const start = this.fromScreen(from.x, from.y, 9);
    stage.group.position.copy(start);
    stage.group.scale.setScalar(0.3);
    this.extra = [targetKey];
    this.rebuildFog();
    this.refit();
    return new Promise((resolve) => {
      this.flight = { key: targetKey, stage, from: start, to, t: 0, startMs: null, resolve };
    });
  }

  /** Zooms into a room, as the raid camera sees it, with the rest of the dungeon lost in fog. */
  flyToRoom(key: string): Promise<void> {
    if (!this.ready) return Promise.resolve();
    this.mode = 'close';
    this.closeKey = key;
    const p = parseKey(key);
    const c = roomWorld(p.x, p.y, this.board);
    this.goalFocus.set(c.x + RAID_START_FOCUS.x, RAID_LOOK_HEIGHT, c.z + RAID_START_FOCUS.z);
    this.goalDistance = RAID_DISTANCE;
    this.goalYaw = 0;
    this.goalFov = RAID_FOV;
    return new Promise((resolve) => {
      this.trip = { startMs: null, resolve };
    });
  }

  /** Starts zoomed into a room (the one the raid ended in) without any travel. */
  startClose(key: string): void {
    this.mode = 'close';
    this.closeKey = key;
    const p = parseKey(key);
    const c = roomWorld(p.x, p.y, this.board);
    this.focus.set(c.x, RAID_LOOK_HEIGHT, c.z);
    this.goalFocus.copy(this.focus);
    this.distance = RAID_DISTANCE;
    this.goalDistance = RAID_DISTANCE;
    this.yaw = 0;
    this.goalYaw = 0;
    this.fov = RAID_FOV;
    this.goalFov = RAID_FOV;
    for (const k of Object.keys(this.rooms)) this.weights[k] = k === key ? 1 : 0;
    this.fogKeyDirty();
  }

  /** Pulls back from a room to the view of the whole dungeon, the fog thinning out again. */
  overview(): Promise<void> {
    if (!this.ready) return Promise.resolve();
    this.mode = 'overview';
    this.closeKey = null;
    this.goalYaw = YAW_DEG;
    this.goalFov = FOV;
    this.refit();
    return new Promise((resolve) => {
      this.trip = { startMs: null, resolve };
    });
  }

  /** A picture of the current frame (used to blend into the next screen). */
  snapshot(): string | null {
    const renderer = this.renderer;
    if (!renderer) return null;
    renderer.render(this.scene, this.camera);
    return renderer.domElement.toDataURL('image/jpeg', 0.85);
  }

  private finishTrip(time: number): void {
    const trip = this.trip;
    if (!trip) return;
    trip.startMs ??= time;
    const near =
      this.focus.distanceTo(this.goalFocus) < 0.15 &&
      Math.abs(this.distance - this.goalDistance) < 0.2 &&
      Math.abs(this.yaw - this.goalYaw) < 0.6;
    if (near || time - trip.startMs > TRIP_MAX_SECONDS * 1000) {
      this.trip = null;
      trip.resolve();
    }
  }

  private fogKeyDirty(): void {
    this.dirty = true;
    this.rebuildFog();
  }

  destroy(): void {
    this.destroyed = true;
    this.renderer?.setAnimationLoop(null);
    for (const e of this.effects) e.dispose();
    this.effects = [];
    this.fog.dispose();
    this.markGeometry.dispose();
    this.highlight.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
    this.renderer = null;
  }

  // ---- rooms -------------------------------------------------------------------------------

  private buildStage(key: string, look: RoomLook): RoomStage {
    const stage = new RoomStage(this.board, { lights: false, fullWalls: true });
    stage.applyModels(this.models);
    showRoom(stage, this.models, look, () => !this.destroyed);
    const p = parseKey(key);
    const w = roomWorld(p.x, p.y, this.board);
    stage.group.position.set(w.x, 0, w.z);
    this.scene.add(stage.group);
    return stage;
  }

  /** A room built without flying in: it drops from above and lands with the same thud. */
  private dropIn(key: string, stage: RoomStage): void {
    const p = parseKey(key);
    const w = roomWorld(p.x, p.y, this.board);
    let t = 0;
    stage.group.position.y = 6;
    this.effects.push({
      update: (dt) => {
        t += dt / DROP_IN_SECONDS;
        const k = Math.min(1, t);
        stage.group.position.y = 6 * (1 - k * k);
        if (k >= 1) {
          this.impact(new Vector3(w.x, 0, w.z));
          return false;
        }
        return true;
      },
      dispose: () => undefined,
    });
  }

  // ---- fog ---------------------------------------------------------------------------------

  /** The fog keeps away from the rooms (and from the room that is about to land). */
  private rebuildFog(): void {
    const keys = [...Object.keys(this.rooms), ...this.extra];
    this.fog.setRooms(
      keys.map((k) => ({ rect: roomRect(k, this.board), weight: this.weights[k] ?? 1 })),
    );
    const key = this.legal.join('|');
    if (key === this.marksKey) return;
    this.marksKey = key;
    this.marks.clear();
    for (const cell of this.legal) {
      const p = parseKey(cell);
      const w = roomWorld(p.x, p.y, this.board);
      const mesh = new Mesh(this.markGeometry, this.highlight);
      mesh.position.set(w.x, 0.05, w.z);
      this.marks.add(mesh);
    }
  }

  // ---- camera ------------------------------------------------------------------------------

  /** Frames every room (and the cells the camera should also show). */
  private refit(snap = false): void {
    if (this.mode === 'close') return;
    const keys = [...Object.keys(this.rooms), ...this.extra, ...this.legal];
    const rect = mapBounds(keys, this.board);
    const corners: Vector3[] = [];
    for (const x of [rect.minX, rect.maxX]) {
      for (const z of [rect.minZ, rect.maxZ]) {
        corners.push(new Vector3(x, 0, z), new Vector3(x, WALL_HEIGHT, z));
      }
    }
    this.goalFocus.set((rect.minX + rect.maxX) / 2, 0, (rect.minZ + rect.maxZ) / 2);
    this.goalDistance = this.fitDistance(this.goalFocus, corners);
    if (snap || !this.ready) {
      this.focus.copy(this.goalFocus);
      this.distance = this.goalDistance;
    }
  }

  private fitDistance(focus: Vector3, corners: Vector3[]): number {
    const probe = this.camera.clone();
    probe.fov = FOV;
    probe.updateProjectionMatrix();
    const dir = this.direction(YAW_DEG);
    let lo = 4;
    let hi = 500;
    for (let i = 0; i < 28; i++) {
      const mid = (lo + hi) / 2;
      probe.position.copy(focus).addScaledVector(dir, mid);
      probe.lookAt(focus);
      probe.updateMatrixWorld(true);
      const fits = corners.every((c) => {
        const p = c.clone().project(probe);
        return Math.abs(p.x) <= 0.97 && Math.abs(p.y) <= 0.97 && p.z < 1;
      });
      if (fits) hi = mid;
      else lo = mid;
    }
    return hi;
  }

  private direction(yawDeg = this.yaw): Vector3 {
    const pitch = (PITCH_DEG * Math.PI) / 180;
    const yaw = (yawDeg * Math.PI) / 180;
    return new Vector3(
      -Math.sin(yaw) * Math.cos(pitch),
      Math.sin(pitch),
      Math.cos(yaw) * Math.cos(pitch),
    );
  }

  private placeCamera(): void {
    const shake = this.shake > 0 ? (this.shake / SHAKE_SECONDS) ** 2 * SHAKE_SIZE : 0;
    this.camera.position
      .copy(this.focus)
      .addScaledVector(this.direction(), this.distance)
      .add(
        new Vector3(
          Math.sin(this.time * 83) * shake,
          Math.cos(this.time * 71) * shake,
          Math.sin(this.time * 57) * shake * 0.5,
        ),
      );
    if (Math.abs(this.camera.fov - this.fov) > 1e-3) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }
    this.camera.lookAt(this.focus);
    this.camera.updateMatrixWorld(true);
  }

  private toScreen(world: Vector3): { x: number; y: number } {
    const p = world.clone().project(this.camera);
    return { x: ((p.x + 1) / 2) * this.width, y: ((1 - p.y) / 2) * this.height };
  }

  /** The point at height `y` that the given screen position looks at. */
  private fromScreen(px: number, py: number, y: number): Vector3 {
    this.placeCamera();
    const ndc = new Vector3((px / this.width) * 2 - 1, 1 - (py / this.height) * 2, 0.5);
    ndc.unproject(this.camera);
    const origin = this.camera.position.clone();
    const dir = ndc.sub(origin).normalize();
    if (Math.abs(dir.y) < 1e-6) return new Vector3(this.focus.x, y, this.focus.z);
    const t = (y - origin.y) / dir.y;
    return origin.addScaledVector(dir, Math.max(0, t));
  }

  // ---- effects -----------------------------------------------------------------------------

  /** The thud of a room hitting the ground: shake, shock ring, dust and a flash. */
  private impact(at: Vector3): void {
    this.shake = SHAKE_SECONDS;

    const ringGeo = new RingGeometry(0.6, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new MeshBasicMaterial({
      color: 0xffe3a8,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const ring = new Mesh(ringGeo, ringMat);
    ring.position.set(at.x, 0.1, at.z);
    this.scene.add(ring);
    let ringT = 0;
    this.effects.push({
      update: (dt) => {
        ringT += dt / 0.55;
        const k = Math.min(1, ringT);
        ring.scale.setScalar(2 + k * this.pitch.x * 0.75);
        ringMat.opacity = 0.9 * (1 - k);
        return k < 1;
      },
      dispose: () => {
        this.scene.remove(ring);
        ringGeo.dispose();
        ringMat.dispose();
      },
    });

    const count = 46;
    const positions = new Float32Array(count * 3);
    const velocities: Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + (i % 5) * 0.3;
      const speed = 3 + (i % 7) * 1.1;
      velocities.push(new Vector3(Math.cos(a) * speed, 1.2 + (i % 4) * 0.5, Math.sin(a) * speed));
      positions.set([at.x, 0.2, at.z], i * 3);
    }
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const dustMat = new PointsMaterial({
      color: 0xc9bfae,
      size: 0.9,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const dust = new Points(dustGeo, dustMat);
    dust.frustumCulled = false;
    this.scene.add(dust);
    let dustT = 0;
    this.effects.push({
      update: (dt) => {
        dustT += dt / 0.9;
        const attr = dustGeo.getAttribute('position');
        for (let i = 0; i < count; i++) {
          const v = velocities[i];
          if (!v) continue;
          attr.setXYZ(i, attr.getX(i) + v.x * dt, attr.getY(i) + v.y * dt, attr.getZ(i) + v.z * dt);
          v.multiplyScalar(1 - dt * 2.4);
          v.y -= dt * 1.5;
        }
        attr.needsUpdate = true;
        dustMat.opacity = 0.8 * Math.max(0, 1 - dustT);
        return dustT < 1;
      },
      dispose: () => {
        this.scene.remove(dust);
        dustGeo.dispose();
        dustMat.dispose();
      },
    });

    const flash = new PointLight(0xffe0a0, 90, 40);
    flash.position.set(at.x, 3, at.z);
    this.scene.add(flash);
    let flashT = 0;
    this.effects.push({
      update: (dt) => {
        flashT += dt / 0.35;
        flash.intensity = 90 * Math.max(0, 1 - flashT);
        return flashT < 1;
      },
      dispose: () => {
        this.scene.remove(flash);
        flash.dispose();
      },
    });
  }

  // ---- loop --------------------------------------------------------------------------------

  private frame(time: number): void {
    const dt = this.lastTime === null ? 0 : Math.min((time - this.lastTime) / 1000, 0.1);
    this.lastTime = time;
    this.time = time / 1000;
    this.updateFlight(time);
    this.effects = this.effects.filter((e) => {
      const alive = e.update(dt);
      if (!alive) e.dispose();
      return alive;
    });
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt);

    const k = 1 - Math.exp(-(this.trip ? TRIP_SPEED : CAMERA_SPEED) * dt);
    const before = this.distance + this.focus.x + this.focus.z + this.yaw + this.fov;
    this.focus.lerp(this.goalFocus, k);
    this.distance += (this.goalDistance - this.distance) * k;
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.fov += (this.goalFov - this.fov) * k;
    for (const key of Object.keys(this.rooms)) {
      const w = this.weights[key] ?? 1;
      const goal = this.mode === 'close' && key !== this.closeKey ? 0 : 1;
      if (Math.abs(goal - w) > 0.002) {
        this.weights[key] = w + (goal - w) * k;
        this.weightsMoved = true;
      }
    }
    if (this.weightsMoved) {
      this.weightsMoved = false;
      this.fogKeyDirty();
    }
    this.placeCamera();
    const moved =
      Math.abs(before - (this.distance + this.focus.x + this.focus.z + this.yaw + this.fov)) > 1e-5;
    this.finishTrip(time);
    if (moved || this.shake > 0) this.cameraListener?.();

    // Draw only when something moves; the slow fog drift and the room models that are still
    // arriving are covered by an occasional idle redraw (rarer when motion is reduced).
    const busy =
      moved ||
      this.shake > 0 ||
      this.flight !== null ||
      this.effects.length > 0 ||
      this.legal.length > 0;
    const idleEvery = reducedMotion() ? 1000 : 60;
    if (!this.dirty && !busy && time - this.lastRender < idleEvery) return;
    this.dirty = false;
    this.lastRender = time;
    this.fog.setTime(reducedMotion() ? 0 : this.time);
    this.highlight.opacity = 0.25 + (0.5 + 0.5 * Math.sin(this.time * 2.4)) * 0.25;
    this.renderer?.render(this.scene, this.camera);
  }

  private updateFlight(time: number): void {
    const f = this.flight;
    if (!f || f.t >= 1) return;
    f.startMs ??= time;
    f.t = Math.min(1, (time - f.startMs) / 1000 / FLIGHT_SECONDS);
    const g = f.stage.group;
    if (f.t < RISE_PART) {
      // Pops up over the popup, turning and growing a little.
      const k = f.t / RISE_PART;
      const e = 1 - (1 - k) ** 3;
      g.position.set(f.from.x, f.from.y + e * 4, f.from.z);
      g.rotation.y = e * 0.6;
      g.scale.setScalar(0.3 + e * 0.15);
      return;
    }
    const k = (f.t - RISE_PART) / (1 - RISE_PART);
    const top = new Vector3(f.from.x, f.from.y + 4, f.from.z);
    const mid = top.clone().lerp(f.to, 0.5);
    mid.y += 10;
    const ease = k * k * (3 - 2 * k);
    const a = top.clone().lerp(mid, ease);
    const b = mid.clone().lerp(f.to, ease);
    g.position.copy(a.lerp(b, ease));
    g.rotation.y = 0.6 * (1 - ease);
    g.scale.setScalar(0.45 + 0.55 * ease);
    if (f.t >= 1) {
      g.position.copy(f.to);
      g.rotation.y = 0;
      g.scale.setScalar(1);
      this.impact(f.to);
      f.resolve();
    }
  }
}
