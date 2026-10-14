import type { Dir, Pos } from './types';

export const DIRS: readonly Dir[] = ['N', 'E', 'S', 'W'];

/** N is up (y - 1), S is down (y + 1). */
export const DELTA: Record<Dir, Pos> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export const OPPOSITE: Record<Dir, Dir> = { N: 'S', E: 'W', S: 'N', W: 'E' };

export function gridKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function posKey(pos: Pos): string {
  return gridKey(pos.x, pos.y);
}

export function parseKey(key: string): Pos {
  const [xs, ys] = key.split(',');
  return { x: Number(xs), y: Number(ys) };
}

export function stepPos(pos: Pos, dir: Dir): Pos {
  const d = DELTA[dir];
  return { x: pos.x + d.x, y: pos.y + d.y };
}

/** Normalizes a door list to canonical N,E,S,W order without duplicates. */
export function canonicalDoors(doors: readonly Dir[]): Dir[] {
  return DIRS.filter((d) => doors.includes(d));
}
