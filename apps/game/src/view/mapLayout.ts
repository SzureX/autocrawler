import { WALL_OFFSET } from './wallLayout';
import type { BoardSize, Vec2 } from './layout';

/** Height of the tallest wall piece, used to frame the camera. */
export const WALL_HEIGHT = 1.4;

/**
 * Distance between two neighbouring room centres: the floor plus the wall, so the east wall of a
 * room and the west wall of its neighbour are one and the same and their doorways line up.
 */
export function roomPitch(board: BoardSize): Vec2 {
  return { x: board.width + 2 * WALL_OFFSET, z: board.height + 2 * WALL_OFFSET };
}

/** World position of the centre of the room at grid position (x, y). */
export function roomWorld(x: number, y: number, board: BoardSize): Vec2 {
  const pitch = roomPitch(board);
  return { x: x * pitch.x, z: y * pitch.z };
}

export function parseKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',');
  return { x: Number(x), y: Number(y) };
}

export interface WorldRect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** The world area the camera must show: the given cells plus a margin (in rooms) around them. */
export function mapBounds(keys: readonly string[], board: BoardSize, marginRooms = 0.6): WorldRect {
  const pitch = roomPitch(board);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const key of keys) {
    const p = parseKey(key);
    const c = roomWorld(p.x, p.y, board);
    minX = Math.min(minX, c.x);
    maxX = Math.max(maxX, c.x);
    minZ = Math.min(minZ, c.z);
    maxZ = Math.max(maxZ, c.z);
  }
  if (!Number.isFinite(minX)) return { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  const mx = (0.5 + marginRooms) * pitch.x;
  const mz = (0.5 + marginRooms) * pitch.z;
  return { minX: minX - mx, maxX: maxX + mx, minZ: minZ - mz, maxZ: maxZ + mz };
}

/** The floor and walls of the room at a cell, as a world rectangle. */
export function roomRect(key: string, board: BoardSize): WorldRect {
  const p = parseKey(key);
  const c = roomWorld(p.x, p.y, board);
  const pitch = roomPitch(board);
  return {
    minX: c.x - pitch.x / 2,
    maxX: c.x + pitch.x / 2,
    minZ: c.z - pitch.z / 2,
    maxZ: c.z + pitch.z / 2,
  };
}
