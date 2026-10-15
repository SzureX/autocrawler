import {
  AmbientLight,
  type BufferGeometry,
  type Material,
  type Object3D,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { cellToWorld, type BoardSize } from './layout';
import type { ModelLibrary } from './models';
import type { RoomLayoutDef } from '@loch/data';
import { measuredCatalog } from './builderCatalog';
import { floorWorld, propYaw, SIDES, type PieceCatalog, type Side } from './roomBuilder';
import { MODEL_SCALE, wallPlacements } from './wallLayout';

/** Floor colours per room type (visual only; the room type itself comes from the log). */
const THEMES: Record<string, { a: number; b: number }> = {
  chamber: { a: 0x2c3345, b: 0x262c3b },
  elite_room: { a: 0x4a2a2e, b: 0x3f2528 },
  chest: { a: 0x4a4326, b: 0x40391f },
  trap_room: { a: 0x4a3322, b: 0x402c1d },
  temple: { a: 0x25424a, b: 0x1f383f },
  boss_room: { a: 0x3d2a52, b: 0x35244a },
};
const DEFAULT_THEME = THEMES['chamber'] ?? { a: 0x2c3345, b: 0x262c3b };

/** Floor variants per room type (keys of MODEL_FILES without the `floor:` prefix); repeats = weight. */
const FLOOR_SETS: Record<string, string[]> = {
  chamber: ['stone', 'stone', 'stone', 'stone', 'stone_broken_a', 'stone_broken_b'],
  elite_room: ['stone', 'stone', 'stone', 'stone_decorated', 'stone_decorated'],
  chest: ['wood', 'wood', 'wood_dark'],
  trap_room: ['stone', 'stone_broken_a', 'stone_broken_b', 'grate'],
  temple: ['stone', 'stone', 'stone', 'stone_weeds_a', 'stone_weeds_b'],
  boss_room: ['wood_dark', 'wood_dark', 'wood_dark', 'grate'],
};
const DEFAULT_FLOOR_SET = FLOOR_SETS['chamber'] ?? ['stone'];

/** Static 3D room: floor, walls with door gaps and lights (models when loaded, else placeholders). */
export class RoomStage {
  readonly group = new Group();
  private content = new Group();
  private readonly board: BoardSize;
  private models: ModelLibrary | null = null;
  private floors: Group | null = null;
  private walls: Group | null = null;
  private props: Group | null = null;
  private layout: RoomLayoutDef | null = null;
  private doors: readonly Side[] = SIDES;
  private catalog: PieceCatalog | null = null;
  private readonly floorA = new MeshStandardMaterial({ color: DEFAULT_THEME.a, roughness: 0.9 });
  private readonly floorB = new MeshStandardMaterial({ color: DEFAULT_THEME.b, roughness: 0.9 });
  private theme: string | null = null;

  constructor(board: BoardSize) {
    this.board = board;
    this.group.add(this.content);
    const content = this.content;
    const tile = new PlaneGeometry(0.98, 0.98);
    tile.rotateX(-Math.PI / 2);
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const mesh = new Mesh(tile, (x + y) % 2 === 0 ? this.floorA : this.floorB);
        const p = cellToWorld(x, y, board);
        mesh.position.set(p.x, 0, p.z);
        mesh.receiveShadow = true;
        content.add(mesh);
      }
    }

    const cx = Math.floor(board.width / 2);
    const cy = Math.floor(board.height / 2);
    const wallMat = new MeshStandardMaterial({ color: 0x4b5368, roughness: 0.8 });
    const wall = new BoxGeometry(1, 1.4, 1);
    const doorCells = new Set([
      `${cx},-1`,
      `${cx},${board.height}`,
      `-1,${cy}`,
      `${board.width},${cy}`,
    ]);
    for (let y = -1; y <= board.height; y++) {
      for (let x = -1; x <= board.width; x++) {
        const ring = x === -1 || y === -1 || x === board.width || y === board.height;
        if (!ring || doorCells.has(`${x},${y}`)) continue;
        const mesh = new Mesh(wall, wallMat);
        const p = cellToWorld(x, y, board);
        // The wall nearest to the camera (south) is kept low so it never hides the action.
        const low = y === board.height;
        mesh.scale.y = low ? 0.22 : 1;
        mesh.position.set(p.x, low ? 0.154 : 0.7, p.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        content.add(mesh);
      }
    }

    const doorMat = new MeshStandardMaterial({
      color: 0xf2c14e,
      emissive: new Color(0xf2c14e),
      emissiveIntensity: 0.6,
    });
    const marker = new BoxGeometry(0.86, 0.03, 0.86);
    for (const [x, y] of [
      [cx, 0],
      [cx, board.height - 1],
      [0, cy],
      [board.width - 1, cy],
    ] as const) {
      const mesh = new Mesh(marker, doorMat);
      const p = cellToWorld(x, y, board);
      mesh.position.set(p.x, 0.02, p.z);
      content.add(mesh);
    }

    this.group.add(new AmbientLight(0xffffff, 0.6));
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
    this.group.add(sun);
  }

  /** Tints the floor for a room type (no-op when unchanged). */
  setTheme(roomTypeId: string | null): void {
    if (roomTypeId === this.theme) return;
    this.theme = roomTypeId;
    const t = (roomTypeId ? THEMES[roomTypeId] : undefined) ?? DEFAULT_THEME;
    this.floorA.color.setHex(t.a);
    this.floorB.color.setHex(t.b);
    if (this.models) this.buildFloors();
  }

  /** Swaps the placeholder room for the glTF pieces (no-op when the needed models are missing). */
  applyModels(models: ModelLibrary): void {
    const needed = ['floor:stone', 'wall:arched', 'wall:half', 'door:doorway'];
    if (!needed.every((id) => models.has(id))) return;
    this.models = models;
    disposeTree(this.content);
    this.group.remove(this.content);
    this.content = new Group();
    this.group.add(this.content);
    this.floors = null;
    this.walls = null;
    this.props = null;
    this.catalog = measuredCatalog(models);
    this.buildFloors();
    this.buildWalls();
    this.buildProps();
  }

  /** The sides that have a doorway (the others get a plain wall). */
  setDoors(doors: readonly Side[]): void {
    this.doors = doors;
    if (this.models) this.buildWalls();
  }

  /** True when every model the layout needs is loaded, so it can be shown at once. */
  canShow(layout: RoomLayoutDef): boolean {
    const models = this.models;
    if (!models) return false;
    return (
      layout.floors.every((f) => models.has(`floor:${f.id}`)) &&
      layout.props.every((p) => models.has(`prop:${p.id}`))
    );
  }

  /** Shows the floors and props of a room layout (null: the default look of the room type). */
  setLayout(layout: RoomLayoutDef | null): void {
    this.layout = layout;
    if (!this.models) return;
    this.catalog = measuredCatalog(this.models);
    this.buildFloors();
    this.buildProps();
  }

  private buildFloors(): void {
    const models = this.models;
    if (!models) return;
    if (this.floors) this.content.remove(this.floors);
    const floors = new Group();
    const layout = this.layout;
    if (layout && this.catalog) {
      for (const f of layout.floors) {
        const piece = models.create(`floor:${f.id}`, false);
        if (!piece) continue;
        const w = floorWorld(f, this.board, this.catalog);
        piece.scale.setScalar(MODEL_SCALE);
        piece.position.set(w.x, 0, w.z);
        piece.rotation.y = w.yaw;
        floors.add(piece);
      }
      this.floors = floors;
      this.content.add(floors);
      return;
    }
    const set = (this.theme ? FLOOR_SETS[this.theme] : undefined) ?? DEFAULT_FLOOR_SET;
    for (let y = 0; y < this.board.height; y++) {
      for (let x = 0; x < this.board.width; x++) {
        // Deterministic pseudo-random pick, so a room always looks the same.
        const id = set[(x * 7 + y * 13 + x * y * 3) % set.length] ?? 'stone';
        const piece = models.create(`floor:${id}`, false) ?? models.create('floor:stone', false);
        if (!piece) continue;
        const p = cellToWorld(x, y, this.board);
        piece.scale.setScalar(MODEL_SCALE);
        piece.position.set(p.x, 0, p.z);
        floors.add(piece);
      }
    }
    this.floors = floors;
    this.content.add(floors);
  }

  /** Walls come from the shared layout; a doorway only on the sides that have a door. */
  private buildWalls(): void {
    const models = this.models;
    if (!models) return;
    if (this.walls) this.content.remove(this.walls);
    const walls = new Group();
    for (const w of wallPlacements(this.board, this.doors)) {
      const piece = models.create(w.model, false);
      if (!piece) continue;
      piece.scale.set(MODEL_SCALE * w.sx, MODEL_SCALE * w.sy, MODEL_SCALE);
      piece.position.set(w.x, 0, w.z);
      piece.rotation.y = w.yaw;
      walls.add(piece);
    }
    this.walls = walls;
    this.content.add(walls);
  }

  /** Props of the room layout (barrels, tables, torches...); none without a layout. */
  private buildProps(): void {
    const models = this.models;
    if (!models) return;
    if (this.props) this.content.remove(this.props);
    const props = new Group();
    for (const p of this.layout?.props ?? []) {
      const piece = models.create(`prop:${p.id}`, false);
      if (!piece) continue;
      piece.scale.setScalar(MODEL_SCALE);
      piece.position.set(p.x, p.y ?? 0.03, p.z);
      piece.rotation.y = propYaw(p.rot);
      props.add(piece);
    }
    this.props = props;
    this.content.add(props);
  }
}

function disposeTree(root: Object3D): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    (mesh.geometry as BufferGeometry | undefined)?.dispose();
    const m = mesh.material as Material | Material[] | undefined;
    if (Array.isArray(m)) m.forEach((x) => x.dispose());
    else m?.dispose();
  });
}
