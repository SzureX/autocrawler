import { propYaw, type FloorPiece, type PropPiece, type RoomLayout } from './roomBuilder';
import { MODEL_SCALE } from './wallLayout';

export interface Bounds {
  min: { x: number; y: number; z: number };
  max: { x: number; y: number; z: number };
}

/** Measures of the models a layout uses (native model units), by `prop:id` / `floor:id` key. */
export interface BoundsSource {
  bounds(key: string): Bounds;
}

export interface Board {
  width: number;
  height: number;
}

/** A prop smaller than this (world units) never blocks: candles, bottles, coins. */
const MIN_BLOCKING_SIZE = 0.5;
/** A prop lower than this (model units) never blocks: ceiling tiles, rugs, flat decorations. */
const MIN_BLOCKING_HEIGHT = 0.4;
/** A floor piece taller than this (model units) blocks its cells (foundations, spikes). */
const TALL_FLOOR = 1.0;
/** The footprint is shrunk by this much (cells) so that a prop only just touching a cell is ignored. */
const SHRINK = 0.12;

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Axis-aligned world rectangle covered by a prop (its rotated model bounds, scaled to cells). */
function propRect(prop: PropPiece, b: Bounds): Rect {
  const yaw = propYaw(prop.rot);
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const xs = [b.min.x, b.max.x].map((v) => v * MODEL_SCALE);
  const zs = [b.min.z, b.max.z].map((v) => v * MODEL_SCALE);
  const corners = xs.flatMap((x) =>
    zs.map((z) => ({ x: x * cos + z * sin, z: -x * sin + z * cos })),
  );
  return {
    x0: prop.x + Math.min(...corners.map((c) => c.x)),
    x1: prop.x + Math.max(...corners.map((c) => c.x)),
    z0: prop.z + Math.min(...corners.map((c) => c.z)),
    z1: prop.z + Math.max(...corners.map((c) => c.z)),
  };
}

function cellsOfRect(rect: Rect, board: Board): [number, number][] {
  const cells: [number, number][] = [];
  const x0 = rect.x0 + SHRINK;
  const x1 = rect.x1 - SHRINK;
  const z0 = rect.z0 + SHRINK;
  const z1 = rect.z1 - SHRINK;
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const cx0 = x - board.width / 2;
      const cz0 = y - board.height / 2;
      if (x0 < cx0 + 1 && x1 > cx0 && z0 < cz0 + 1 && z1 > cz0) cells.push([x, y]);
    }
  }
  return cells;
}

/**
 * Board cells a layout blocks for movement: floor-standing props of a real size and tall floor
 * pieces. Wall-mounted props (they hang at `y`) and small or flat ones never block.
 */
export function blockedFromLayout(
  layout: RoomLayout,
  board: Board,
  source: BoundsSource,
  floorSize: (id: string) => { w: number; h: number },
): [number, number][] {
  const blocked: Record<string, [number, number]> = {};
  const add = (cells: [number, number][]) => {
    for (const c of cells) blocked[`${c[0]},${c[1]}`] = c;
  };
  for (const prop of layout.props) {
    if (prop.y !== undefined && prop.y > 0) continue;
    const b = source.bounds(`prop:${prop.id}`);
    const w = (b.max.x - b.min.x) * MODEL_SCALE;
    const d = (b.max.z - b.min.z) * MODEL_SCALE;
    if (Math.max(w, d) < MIN_BLOCKING_SIZE) continue;
    if (b.max.y < MIN_BLOCKING_HEIGHT) continue;
    add(cellsOfRect(propRect(prop, b), board));
  }
  for (const floor of layout.floors) {
    const b = source.bounds(`floor:${floor.id}`);
    if (b.max.y <= TALL_FLOOR) continue;
    add(floorCells(floor, floorSize));
  }
  return Object.values(blocked).sort((a, b) => a[1] - b[1] || a[0] - b[0]);
}

function floorCells(
  floor: FloorPiece,
  floorSize: (id: string) => { w: number; h: number },
): [number, number][] {
  const size = floorSize(floor.id);
  const swap = floor.rot % 2 === 1;
  const w = swap ? size.h : size.w;
  const h = swap ? size.w : size.h;
  const cells: [number, number][] = [];
  for (let y = floor.y; y < floor.y + h; y++)
    for (let x = floor.x; x < floor.x + w; x++) cells.push([x, y]);
  return cells;
}

/** Door cells in the middle of each side of the board (as in the combat board). */
export function doorCellOf(side: 'N' | 'E' | 'S' | 'W', board: Board): [number, number] {
  const cx = Math.floor(board.width / 2);
  const cy = Math.floor(board.height / 2);
  switch (side) {
    case 'N':
      return [cx, 0];
    case 'S':
      return [cx, board.height - 1];
    case 'W':
      return [0, cy];
    case 'E':
      return [board.width - 1, cy];
  }
}

export interface ValidationIssue {
  /** i18n key (`dev.layout.issue.*`) */
  key: string;
  params?: Record<string, string | number>;
}

export interface ValidationInput {
  layout: RoomLayout;
  board: Board;
  blocked: readonly [number, number][];
  /** Sides that have a door in this layout (all four for a normal layout). */
  doors: readonly ('N' | 'E' | 'S' | 'W')[];
  /** Cells the game keeps for itself: the chest and the cell in front of it, or the boss. */
  reserved: readonly [number, number][];
  /** Cells that must be reachable from the doors (the cell in front of the chest, the boss). */
  mustReach: readonly [number, number][];
  floorSize: (id: string) => { w: number; h: number };
}

const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

/**
 * Checks a layout against what the game needs. Errors stop the save: a blocked door or reserved
 * cell, or free cells the hero could never reach (monsters could spawn there). A floor that does
 * not cover the whole room is only a warning.
 */
export function validateLayout(input: ValidationInput): {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
} {
  const { board } = input;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const blocked = new Set(input.blocked.map(([x, y]) => `${x},${y}`));
  const key = (x: number, y: number) => `${x},${y}`;

  const doorCells = input.doors.map((d) => doorCellOf(d, board));
  for (const [x, y] of doorCells) {
    if (blocked.has(key(x, y))) errors.push({ key: 'dev.layout.issue.door', params: { x, y } });
  }
  for (const [x, y] of input.reserved) {
    if (blocked.has(key(x, y))) errors.push({ key: 'dev.layout.issue.reserved', params: { x, y } });
  }

  const start = doorCells[0] ?? input.mustReach[0];
  if (start && !blocked.has(key(start[0], start[1]))) {
    const seen = new Set<string>([key(start[0], start[1])]);
    const queue: [number, number][] = [start];
    for (let head = 0; head < queue.length; head++) {
      const cur = queue[head];
      if (!cur) break;
      for (const [dx, dy] of NEIGHBOURS) {
        const nx = cur[0] + dx;
        const ny = cur[1] + dy;
        if (nx < 0 || ny < 0 || nx >= board.width || ny >= board.height) continue;
        if (blocked.has(key(nx, ny)) || seen.has(key(nx, ny))) continue;
        seen.add(key(nx, ny));
        queue.push([nx, ny]);
      }
    }
    const free = board.width * board.height - blocked.size;
    if (seen.size < free) {
      errors.push({ key: 'dev.layout.issue.isolated', params: { n: free - seen.size } });
    }
    for (const [x, y] of [...doorCells, ...input.mustReach]) {
      if (!blocked.has(key(x, y)) && !seen.has(key(x, y))) {
        errors.push({ key: 'dev.layout.issue.unreachable', params: { x, y } });
      }
    }
  }

  const covered = new Set<string>();
  for (const f of input.layout.floors) {
    for (const [x, y] of floorCells(f, input.floorSize)) covered.add(key(x, y));
  }
  const holes = board.width * board.height - covered.size;
  if (holes > 0) warnings.push({ key: 'dev.layout.issue.holes', params: { n: holes } });
  return { errors, warnings };
}
