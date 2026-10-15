import type { Dir } from '../types';
import type { Cell } from './types';

export interface BoardSize {
  width: number;
  height: number;
}

/** Door cells in the middle of each side of the room board. */
export function doorCell(board: BoardSize, dir: Dir): Cell {
  const cx = Math.floor(board.width / 2);
  const cy = Math.floor(board.height / 2);
  switch (dir) {
    case 'N':
      return { x: cx, y: 0 };
    case 'S':
      return { x: cx, y: board.height - 1 };
    case 'W':
      return { x: 0, y: cy };
    case 'E':
      return { x: board.width - 1, y: cy };
  }
}

/** The cell just outside the board, in front of the door on `dir` (where a hero walks in from). */
export function outsideCell(board: BoardSize, dir: Dir): Cell {
  const door = doorCell(board, dir);
  switch (dir) {
    case 'N':
      return { x: door.x, y: door.y - 1 };
    case 'S':
      return { x: door.x, y: door.y + 1 };
    case 'W':
      return { x: door.x - 1, y: door.y };
    case 'E':
      return { x: door.x + 1, y: door.y };
  }
}

/** Range metric: Chebyshev distance (diagonals cost 1). */
export function cheb(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

export function inBoard(board: BoardSize, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < board.width && y < board.height;
}

/** Fixed neighbour order (N, NE, E, SE, S, SW, W, NW) keeps pathing deterministic. */
export const NEIGHBORS: readonly Cell[] = [
  { x: 0, y: -1 },
  { x: 1, y: -1 },
  { x: 1, y: 0 },
  { x: 1, y: 1 },
  { x: 0, y: 1 },
  { x: -1, y: 1 },
  { x: -1, y: 0 },
  { x: -1, y: -1 },
];

interface Node {
  x: number;
  y: number;
  g: number;
  h: number;
  order: number;
  parent: Node | null;
}

/**
 * A* over the board (8 directions, uniform cost). The board has no static walls, so the
 * "no corner cutting" rule is vacuous; units block cells but not corners.
 * Returns the first step towards the nearest cell within `range` of `target`, or null.
 */
export function findStep(
  board: BoardSize,
  from: Cell,
  target: Cell,
  range: number,
  blocked: (x: number, y: number) => boolean,
): Cell | null {
  const heuristic = (x: number, y: number): number => Math.max(0, cheb({ x, y }, target) - range);
  const closed = new Uint8Array(board.width * board.height);
  const best = new Int32Array(board.width * board.height).fill(1 << 30);
  const open: Node[] = [];
  let counter = 0;
  const startNode: Node = {
    x: from.x,
    y: from.y,
    g: 0,
    h: heuristic(from.x, from.y),
    order: counter++,
    parent: null,
  };
  open.push(startNode);
  best[from.y * board.width + from.x] = 0;

  while (open.length > 0) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) {
      const a = open[i] as Node;
      const b = open[bi] as Node;
      const fa = a.g + a.h;
      const fb = b.g + b.h;
      if (fa < fb || (fa === fb && (a.h < b.h || (a.h === b.h && a.order < b.order)))) bi = i;
    }
    const cur = open.splice(bi, 1)[0] as Node;
    const ci = cur.y * board.width + cur.x;
    if (closed[ci]) continue;
    closed[ci] = 1;
    if (cur.h === 0 && cur.parent !== null) {
      let n: Node = cur;
      while (n.parent && n.parent.parent) n = n.parent;
      return { x: n.x, y: n.y };
    }
    for (const d of NEIGHBORS) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      if (!inBoard(board, nx, ny) || blocked(nx, ny)) continue;
      const ni = ny * board.width + nx;
      if (closed[ni]) continue;
      const g = cur.g + 1;
      if (g >= (best[ni] as number)) continue;
      best[ni] = g;
      open.push({ x: nx, y: ny, g, h: heuristic(nx, ny), order: counter++, parent: cur });
    }
  }
  return null;
}

/**
 * Neighbouring free cell that increases the distance to `threat` the most
 * (strictly more than now); null when the unit is cornered.
 */
export function findRetreat(
  board: BoardSize,
  from: Cell,
  threat: Cell,
  blocked: (x: number, y: number) => boolean,
): Cell | null {
  let best: Cell | null = null;
  let bestDist = cheb(from, threat);
  for (const d of NEIGHBORS) {
    const nx = from.x + d.x;
    const ny = from.y + d.y;
    if (!inBoard(board, nx, ny) || blocked(nx, ny)) continue;
    const dist = cheb({ x: nx, y: ny }, threat);
    if (dist > bestDist) {
      bestDist = dist;
      best = { x: nx, y: ny };
    }
  }
  return best;
}
