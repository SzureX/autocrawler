import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
} from 'three';
import { cellToWorld, type BoardSize } from './layout';

/** Floor colours per room type (visual only; the room type itself comes from the log). */
const THEMES: Record<string, { a: number; b: number }> = {
  chamber: { a: 0x2c3345, b: 0x262c3b },
  elite_room: { a: 0x4a2a2e, b: 0x3f2528 },
  treasury: { a: 0x4a4326, b: 0x40391f },
  trap_room: { a: 0x4a3322, b: 0x402c1d },
  sanctuary: { a: 0x25424a, b: 0x1f383f },
  boss_room: { a: 0x3d2a52, b: 0x35244a },
};
const DEFAULT_THEME = THEMES['chamber'] ?? { a: 0x2c3345, b: 0x262c3b };

/** Static 3D room: checkered floor, walls with door gaps, door markers and lights. */
export class RoomStage {
  readonly group = new Group();
  private readonly floorA = new MeshStandardMaterial({ color: DEFAULT_THEME.a, roughness: 0.9 });
  private readonly floorB = new MeshStandardMaterial({ color: DEFAULT_THEME.b, roughness: 0.9 });
  private theme: string | null = null;

  constructor(board: BoardSize) {
    const tile = new PlaneGeometry(0.98, 0.98);
    tile.rotateX(-Math.PI / 2);
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const mesh = new Mesh(tile, (x + y) % 2 === 0 ? this.floorA : this.floorB);
        const p = cellToWorld(x, y, board);
        mesh.position.set(p.x, 0, p.z);
        mesh.receiveShadow = true;
        this.group.add(mesh);
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
        this.group.add(mesh);
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
      this.group.add(mesh);
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
  }
}
