import type { BoardSize, Side } from './roomBuilder';

/** Dungeon models are authored on a 2-unit grid; the board cell is 1 unit. */
export const MODEL_SCALE = 0.5;
/** The wall facing the camera is kept low so it never hides the action. */
export const LOW_WALL = 0.3;
/** Distance from the edge of the floor to a wall's centre line (walls are half a cell thick). */
export const WALL_OFFSET = MODEL_SCALE * 0.5;

/** One wall model to draw: its library key, position, turn and stretch (before MODEL_SCALE). */
export interface WallPlacement {
  /** Library key: `door:doorway`, `wall:arched` or `wall:half`. */
  model: string;
  x: number;
  z: number;
  yaw: number;
  /** Stretch along the wall (negative mirrors the piece). */
  sx: number;
  /** Stretch in height (the south wall is low). */
  sy: number;
}

/**
 * The walls of a room, shared by the raid view and the room builder so both look the same.
 * North and south: a doorway (or a plain arch) in the middle and two slightly squeezed arches on
 * each side. West and east own the corners: a doorway (or arch), then an arch and a half wall on
 * each side. A side listed in `doors` gets a doorway; the others a plain arched wall.
 */
export function wallPlacements(
  board: BoardSize,
  doors: readonly Side[],
  lowSouth = true,
): WallPlacement[] {
  const halfW = board.width / 2;
  const halfH = board.height / 2;
  const out: WallPlacement[] = [];
  const middle = (side: Side) => (doors.includes(side) ? 'door:doorway' : 'wall:arched');

  const span = halfW - 1;
  const archScale = span / 2 / (4 * MODEL_SCALE);
  const ends: [Side, number, number, number][] = [
    ['N', -(halfH + WALL_OFFSET), 0, 1],
    ['S', halfH + WALL_OFFSET, Math.PI, lowSouth ? LOW_WALL : 1],
  ];
  for (const [side, z, yaw, sy] of ends) {
    out.push({ model: middle(side), x: 0, z, yaw, sx: 1, sy });
    for (const dir of [-1, 1]) {
      out.push({ model: 'wall:arched', x: dir * (1 + span / 4), z, yaw, sx: archScale, sy });
      out.push({ model: 'wall:arched', x: dir * (1 + (span * 3) / 4), z, yaw, sx: archScale, sy });
    }
  }

  const flanks: [Side, number, number][] = [
    ['W', -(halfW + WALL_OFFSET), Math.PI / 2],
    ['E', halfW + WALL_OFFSET, -Math.PI / 2],
  ];
  for (const [side, x, yaw] of flanks) {
    out.push({ model: middle(side), x, z: 0, yaw, sx: 1, sy: 1 });
    const alongZ = -Math.sin(yaw); // direction of the piece's local +x on the z axis
    for (const dir of [-1, 1]) {
      out.push({ model: 'wall:arched', x, z: dir * 2, yaw, sx: 1, sy: 1 });
      // The half wall's origin is at one end; mirror it so it grows away from the doorway.
      out.push({ model: 'wall:half', x, z: dir * 3, yaw, sx: alongZ === dir ? 1 : -1, sy: 1 });
    }
  }
  return out;
}
