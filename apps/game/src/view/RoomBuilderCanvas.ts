import {
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Scene,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Material,
  type Object3D,
} from 'three';
import {
  BUILDER_ASSETS,
  PROP_ASSETS,
  assetKey,
  builderFiles,
  measuredCatalog,
  propFiles,
  propMount,
} from './builderCatalog';
import { ModelLibrary } from './models';
import { renderThumbnails } from './thumbnails';
import {
  floorWorld,
  nearestWallMount,
  propYaw,
  snapProp,
  type FloorPiece,
  type PieceCatalog,
  type PropPiece,
  type RoomLayout,
  type Side,
} from './roomBuilder';
import { MODEL_SCALE, wallPlacements } from './wallLayout';

const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 680;
/** The wall models the room needs (the walls are generated, not placed by hand). */
const WALL_MODELS = ['wall:arched', 'wall:half', 'door:doorway'];

/** What the pointer holds: a piece (or nothing = eraser), for the floor or the props layer. */
export interface BuilderTool {
  layer: 'floor' | 'prop';
  /** Piece id; null is the eraser. */
  pieceId: string | null;
  rot: number;
  /** Floor group mode: every placement picks a random piece and rotation from this pool. */
  pool: string[] | null;
}

/** Where a click lands, already snapped to the board. */
export type BuilderTarget =
  | { type: 'floor'; piece: FloorPiece }
  | { type: 'floorCell'; x: number; y: number }
  | { type: 'prop'; piece: PropPiece }
  | { type: 'propNear'; x: number; z: number };

export interface BuilderAction {
  erase: boolean;
  target: BuilderTarget;
}

function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    mesh.geometry?.dispose();
    const m = mesh.material as Material | Material[] | undefined;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}

/** Three.js scene of the room builder: renders a layout, previews the held piece, reports clicks. */
export class RoomBuilderCanvas {
  private readonly models = new ModelLibrary();
  private renderer: WebGLRenderer | null = null;
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(45, VIEW_WIDTH / VIEW_HEIGHT, 0.1, 100);
  private readonly raycaster = new Raycaster();
  private readonly ground = new Plane(new Vector3(0, 1, 0), 0);
  private readonly floors = new Group();
  private readonly walls = new Group();
  private readonly props = new Group();
  private readonly ghost = new Group();
  private ghostKey = '';
  private layout: RoomLayout = { floors: [], props: [] };
  private doors: readonly Side[] = [];
  private tool: BuilderTool = { layer: 'floor', pieceId: null, rot: 0, pool: null };
  /** The piece the next click places (rolled again after every placement in group mode). */
  private held: { id: string | null; rot: number } = { id: null, rot: 0 };
  private topDown = false;
  private hoverKey = '';
  private destroyed = false;
  private listener: ((a: BuilderAction) => void) | null = null;
  catalog: PieceCatalog = { floorSize: () => ({ w: 1, h: 1 }) };

  constructor(
    private readonly host: HTMLElement,
    private readonly board: { width: number; height: number },
  ) {
    this.scene.background = new Color(0x14161c);
    const base = new Mesh(
      new PlaneGeometry(this.board.width, this.board.height),
      new MeshBasicMaterial({ color: 0x0b0c10 }),
    );
    base.rotation.x = -Math.PI / 2;
    base.position.y = -1.2;
    this.scene.add(base, this.floors, this.walls, this.props, this.ghost, this.gridLines());
    this.scene.add(new AmbientLight(0xffffff, 0.6));
    const sun = new DirectionalLight(0xffffff, 1.9);
    sun.position.set(4, 9, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    const cam = sun.shadow.camera;
    cam.left = -8;
    cam.right = 8;
    cam.top = 8;
    cam.bottom = -8;
    cam.near = 1;
    cam.far = 30;
    this.scene.add(sun);
    this.placeCamera();
  }

  async init(): Promise<void> {
    if (this.destroyed) return;
    const renderer = new WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio || 1, 2));
    renderer.setSize(VIEW_WIDTH, VIEW_HEIGHT);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = PCFShadowMap;
    this.host.appendChild(renderer.domElement);
    this.renderer = renderer;
    const el = renderer.domElement;
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointerleave', this.onLeave);
    el.addEventListener('contextmenu', this.onContext);
    renderer.setAnimationLoop(() => renderer.render(this.scene, this.camera));

    this.models.register(builderFiles());
    await this.models.load([...BUILDER_ASSETS.map(assetKey), ...WALL_MODELS], {
      animations: false,
    });
    if (this.destroyed) return;
    this.catalog = measuredCatalog(this.models);
    this.rebuild();
  }

  /** Small pictures of every loaded piece, by library key (`floor:tile_small`). */
  thumbnails(): Record<string, string> {
    return renderThumbnails(this.models, BUILDER_ASSETS.map(assetKey));
  }

  /** Measures of a loaded model (native units), zeros when it is not loaded. */
  bounds(key: string): {
    min: { x: number; y: number; z: number };
    max: { x: number; y: number; z: number };
  } {
    return this.models.bounds(key);
  }

  /** Loads the prop models (many files, so only when the Props layer is first opened). */
  async loadProps(): Promise<Record<string, string>> {
    this.models.register(propFiles());
    const keys = PROP_ASSETS.map(assetKey);
    await this.models.load(keys, { animations: false });
    if (this.destroyed) return {};
    this.rebuild();
    return renderThumbnails(this.models, keys);
  }

  onAction(cb: (a: BuilderAction) => void): void {
    this.listener = cb;
  }

  setLayout(layout: RoomLayout): void {
    this.layout = layout;
    this.rebuild();
  }

  /** Sides that have a doorway; the other sides get a plain wall. */
  setDoors(doors: readonly Side[]): void {
    this.doors = doors;
    this.rebuild();
  }

  setTool(tool: BuilderTool): void {
    this.tool = tool;
    this.reroll();
    this.hoverKey = '';
    this.ghostKey = '';
    this.clearGhost();
  }

  setTopDown(on: boolean): void {
    this.topDown = on;
    this.placeCamera();
  }

  destroy(): void {
    this.destroyed = true;
    this.listener = null;
    const renderer = this.renderer;
    if (!renderer) return;
    const el = renderer.domElement;
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointerleave', this.onLeave);
    el.removeEventListener('contextmenu', this.onContext);
    renderer.setAnimationLoop(null);
    disposeTree(this.scene);
    renderer.dispose();
    renderer.forceContextLoss();
    el.remove();
    this.renderer = null;
  }

  private gridLines(): LineSegments {
    const { width, height } = this.board;
    const v: number[] = [];
    for (let x = 0; x <= width; x++)
      v.push(x - width / 2, 0.04, -height / 2, x - width / 2, 0.04, height / 2);
    for (let y = 0; y <= height; y++)
      v.push(-width / 2, 0.04, y - height / 2, width / 2, 0.04, y - height / 2);
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new Float32BufferAttribute(v, 3));
    return new LineSegments(
      geometry,
      new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
    );
  }

  private placeCamera(): void {
    if (this.topDown) {
      this.camera.position.set(0, 13, 0.01);
      this.camera.lookAt(0, 0, 0);
    } else {
      this.camera.position.set(0, 9.5, 8.2);
      this.camera.lookAt(0, 0.2, 0.4);
    }
  }

  /** Rebuilds the visible floors, props and walls. */
  private rebuild(): void {
    this.floors.clear();
    this.walls.clear();
    this.props.clear();
    for (const prop of this.layout.props) {
      const model = this.models.create(`prop:${prop.id}`, false);
      if (!model) continue;
      model.scale.setScalar(MODEL_SCALE);
      model.position.set(prop.x, prop.y ?? 0.03, prop.z);
      model.rotation.y = propYaw(prop.rot);
      this.props.add(model);
    }
    for (const f of this.layout.floors) {
      const model = this.models.create(`floor:${f.id}`, false);
      if (!model) continue;
      const w = floorWorld(f, this.board, this.catalog);
      model.scale.setScalar(MODEL_SCALE);
      model.position.set(w.x, 0, w.z);
      model.rotation.y = w.yaw;
      this.floors.add(model);
    }
    for (const w of wallPlacements(this.board, this.doors)) {
      const model = this.models.create(w.model, false);
      if (!model) continue;
      model.scale.set(MODEL_SCALE * w.sx, MODEL_SCALE * w.sy, MODEL_SCALE);
      model.position.set(w.x, 0, w.z);
      model.rotation.y = w.yaw;
      this.walls.add(model);
    }
  }

  private clearGhost(): void {
    for (const child of [...this.ghost.children]) {
      this.ghost.remove(child);
      disposeTree(child);
    }
  }

  /** Board point under the pointer, or null when the ray misses the ground. */
  private pointer(e: PointerEvent): { x: number; z: number } | null {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const ndc = new Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -(((e.clientY - rect.top) / rect.height) * 2 - 1),
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new Vector3();
    return this.raycaster.ray.intersectPlane(this.ground, hit) ? { x: hit.x, z: hit.z } : null;
  }

  /** Snaps a board point to what the current tool would place or erase there. */
  private targetAt(p: { x: number; z: number }, erase: boolean): BuilderTarget | null {
    const { width, height } = this.board;
    const id = this.held.id;
    if (this.tool.layer === 'prop') {
      if (erase || id === null) return { type: 'propNear', x: p.x, z: p.z };
      const mount = propMount(id);
      if (mount) {
        const at = nearestWallMount(p, this.board, mount.depth);
        return { type: 'prop', piece: { id, ...at, y: mount.y * MODEL_SCALE } };
      }
      const at = snapProp(p, this.board);
      return { type: 'prop', piece: { id, x: at.x, z: at.z, rot: this.held.rot } };
    }
    if (!erase && this.tool.pool && this.tool.pool.length === 0) return null;
    if (erase || id === null) {
      const x = Math.floor(p.x + width / 2);
      const y = Math.floor(p.z + height / 2);
      if (x < 0 || y < 0 || x >= width || y >= height) return null;
      return { type: 'floorCell', x, y };
    }
    const piece = { id, x: 0, y: 0, rot: this.held.rot };
    const size = this.catalog.floorSize(id);
    const w = this.held.rot % 2 === 1 ? size.h : size.w;
    const h = this.held.rot % 2 === 1 ? size.w : size.h;
    piece.x = Math.min(width - w, Math.max(0, Math.round(p.x + width / 2 - w / 2)));
    piece.y = Math.min(height - h, Math.max(0, Math.round(p.z + height / 2 - h / 2)));
    return { type: 'floor', piece };
  }

  private updateGhost(target: BuilderTarget | null, erase: boolean): void {
    if (!target || erase || this.held.id === null) {
      this.clearGhost();
      this.ghostKey = '';
      return;
    }
    const key = `${this.tool.layer}:${this.held.id}`;
    if (this.ghostKey !== key || this.ghost.children.length === 0) {
      this.clearGhost();
      const model = this.models.create(key, false);
      if (!model) return;
      model.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        const fade = (m: Material): Material => {
          const c = m.clone();
          c.transparent = true;
          c.opacity = 0.55;
          c.depthWrite = false;
          return c;
        };
        mesh.material = Array.isArray(mesh.material)
          ? mesh.material.map(fade)
          : fade(mesh.material);
        mesh.castShadow = false;
      });
      this.ghost.add(model);
      this.ghostKey = key;
    }
    const model = this.ghost.children[0];
    if (!model) return;
    if (target.type === 'floor') {
      const w = floorWorld(target.piece, this.board, this.catalog);
      model.scale.setScalar(MODEL_SCALE);
      model.position.set(w.x, 0.05, w.z);
      model.rotation.y = w.yaw;
    } else if (target.type === 'prop') {
      model.scale.setScalar(MODEL_SCALE);
      model.position.set(target.piece.x, target.piece.y ?? 0.03, target.piece.z);
      model.rotation.y = propYaw(target.piece.rot);
    }
  }

  private emit(erase: boolean, p: { x: number; z: number }): void {
    const target = this.targetAt(p, erase);
    if (!target) return;
    this.listener?.({ erase, target });
    if (!erase && this.tool.pool) {
      this.reroll();
      this.updateGhost(this.targetAt(p, false), false);
    }
  }

  /** Decides what a click places: the chosen piece, or a random one (and rotation) from the pool. */
  private reroll(): void {
    const pool = this.tool.layer === 'floor' ? this.tool.pool : null;
    if (pool && pool.length > 0) {
      this.held = {
        id: pool[Math.floor(Math.random() * pool.length)] ?? null,
        rot: Math.floor(Math.random() * 4),
      };
    } else {
      this.held = { id: this.tool.pieceId, rot: this.tool.rot };
    }
  }

  private readonly onMove = (e: PointerEvent): void => {
    const p = this.pointer(e);
    if (!p) return;
    const erase = (e.buttons & 2) !== 0;
    const target = this.targetAt(p, erase);
    // Compare positions only: a re-rolled piece on the same spot must not repeat a painted click.
    const key = JSON.stringify(
      target?.type === 'floor'
        ? [target.piece.x, target.piece.y]
        : target?.type === 'prop'
          ? [target.piece.x, target.piece.z]
          : target,
    );
    if (key === this.hoverKey) return;
    this.hoverKey = key;
    this.updateGhost(target, erase);
    // Painting: holding a button while moving repeats the action on every new cell.
    if (e.buttons & 1 && this.tool.layer !== 'prop') this.emit(false, p);
    else if (e.buttons & 2) this.emit(true, p);
  };

  private readonly onDown = (e: PointerEvent): void => {
    const p = this.pointer(e);
    if (!p || (e.button !== 0 && e.button !== 2)) return;
    this.emit(e.button === 2, p);
    this.hoverKey = '';
  };

  private readonly onLeave = (): void => {
    this.hoverKey = '';
    this.clearGhost();
    this.ghostKey = '';
  };

  private readonly onContext = (e: Event): void => e.preventDefault();
}
