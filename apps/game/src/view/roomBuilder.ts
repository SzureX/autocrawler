import { WALL_OFFSET } from './wallLayout';

/**
 * Pure model of the room builder (no Three.js): floor pieces on the 9x7 board and props placed on
 * a half-cell grid. The walls and doors are not edited by hand: they come from `wallPlacements`
 * for the doors of the chosen room.
 */
export type Side = 'N' | 'E' | 'S' | 'W';

export const SIDES: readonly Side[] = ['N', 'E', 'S', 'W'];

export interface BoardSize {
  width: number;
  height: number;
}

/** Floor piece: `x,y` is the top-left cell of its footprint, `rot` is quarter turns (0-3). */
export interface FloorPiece {
  id: string;
  x: number;
  y: number;
  rot: number;
}

/** Prop (barrel, torch, table…): position on a half-cell grid, `rot` in eighth turns (0-7). */
export interface PropPiece {
  id: string;
  /** World coordinates in cells, board centred on the origin; multiples of 0.5. */
  x: number;
  z: number;
  rot: number;
  /** Height above the floor for wall-mounted props (torches, shelves…); default 0. */
  y?: number;
}

export interface RoomLayout {
  floors: FloorPiece[];
  props: PropPiece[];
}

/** Sizes of the floor pieces, measured from the loaded models. */
export interface PieceCatalog {
  floorSize(id: string): { w: number; h: number };
}

export function emptyLayout(): RoomLayout {
  return { floors: [], props: [] };
}

/** Yaw (radians) of a prop turned `rot` eighth turns. */
export function propYaw(rot: number): number {
  return (((rot % 8) + 8) % 8) * (Math.PI / 4);
}

/** Footprint of a floor piece in cells (a quarter turn swaps width and height). */
export function floorFootprint(
  piece: FloorPiece,
  catalog: PieceCatalog,
): { x: number; y: number; w: number; h: number } {
  const size = catalog.floorSize(piece.id);
  const swap = piece.rot % 2 === 1;
  return { x: piece.x, y: piece.y, w: swap ? size.h : size.w, h: swap ? size.w : size.h };
}

function overlaps(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** Places a floor piece, replacing every piece it overlaps; null when it leaves the board. */
export function placeFloor(
  layout: RoomLayout,
  piece: FloorPiece,
  board: BoardSize,
  catalog: PieceCatalog,
): RoomLayout | null {
  const fp = floorFootprint(piece, catalog);
  if (fp.x < 0 || fp.y < 0 || fp.x + fp.w > board.width || fp.y + fp.h > board.height) return null;
  const kept = layout.floors.filter((f) => !overlaps(fp, floorFootprint(f, catalog)));
  return { ...layout, floors: [...kept, piece] };
}

/** Removes the floor piece covering a cell (no-op when the cell is empty). */
export function removeFloorAt(
  layout: RoomLayout,
  cell: { x: number; y: number },
  catalog: PieceCatalog,
): RoomLayout {
  const at = { x: cell.x, y: cell.y, w: 1, h: 1 };
  return {
    ...layout,
    floors: layout.floors.filter((f) => !overlaps(at, floorFootprint(f, catalog))),
  };
}

/** World placement (1 cell = 1 unit, board centred on the origin) of a floor piece's centre. */
export function floorWorld(
  piece: FloorPiece,
  board: BoardSize,
  catalog: PieceCatalog,
): { x: number; z: number; yaw: number } {
  const fp = floorFootprint(piece, catalog);
  return {
    x: fp.x + fp.w / 2 - board.width / 2,
    z: fp.y + fp.h / 2 - board.height / 2,
    yaw: (piece.rot % 4) * (Math.PI / 2),
  };
}

/** Small stone floor everywhere and no props. */
export function defaultLayout(board: BoardSize): RoomLayout {
  const floors: FloorPiece[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) floors.push({ id: 'tile_small', x, y, rot: 0 });
  }
  return { floors, props: [] };
}

/** A room as the dungeon can produce it: which sides have doors. */
export interface RoomPreset {
  id: string;
  kind: 'all' | 'start' | 'regular' | 'boss';
  doors: Side[];
  entrance?: Side;
  exit?: Side;
}

/**
 * Every door layout a room can have in the one-way chain: the start room (exit east), regular
 * rooms (entrance facing the previous exit, exit north, east or south), and the boss room
 * (entrance only). Plus a preview with all four doors.
 */
export const ROOM_PRESETS: RoomPreset[] = (() => {
  const presets: RoomPreset[] = [{ id: 'all', kind: 'all', doors: [...SIDES] }];
  presets.push({ id: 'start', kind: 'start', doors: ['E'], exit: 'E' });
  // The previous room's exit is N, E or S, so the entrance is S, W or N.
  for (const entrance of ['W', 'N', 'S'] as const) {
    for (const exit of ['N', 'E', 'S'] as const) {
      if (exit === entrance) continue;
      presets.push({
        id: `room-${entrance}${exit}`,
        kind: 'regular',
        doors: SIDES.filter((d) => d === entrance || d === exit),
        entrance,
        exit,
      });
    }
  }
  for (const entrance of ['W', 'N', 'S'] as const) {
    presets.push({ id: `boss-${entrance}`, kind: 'boss', doors: [entrance], entrance });
  }
  return presets;
})();

/** Snaps a world point to the half-cell grid and keeps it inside the board. */
export function snapProp(
  point: { x: number; z: number },
  board: BoardSize,
): { x: number; z: number } {
  const snap = (v: number, half: number) => Math.min(half, Math.max(-half, Math.round(v * 2) / 2));
  return { x: snap(point.x, board.width / 2), z: snap(point.z, board.height / 2) };
}

/** Adds a prop (props may share a spot, e.g. a candle on a table); null outside the walls. */
export function placeProp(
  layout: RoomLayout,
  piece: PropPiece,
  board: BoardSize,
): RoomLayout | null {
  // Wall-mounted props sit on the wall's centre line, a quarter cell beyond the floor.
  const limitX = board.width / 2 + WALL_OFFSET;
  const limitZ = board.height / 2 + WALL_OFFSET;
  if (Math.abs(piece.x) > limitX || Math.abs(piece.z) > limitZ) return null;
  return { ...layout, props: [...layout.props, piece] };
}

/** Removes the prop nearest to a point (the last placed wins a tie) within `radius` cells. */
export function removePropNear(
  layout: RoomLayout,
  point: { x: number; z: number },
  radius = 0.75,
): RoomLayout {
  let best = -1;
  let bestDist = radius;
  layout.props.forEach((p, i) => {
    const d = Math.hypot(p.x - point.x, p.z - point.z);
    if (d <= bestDist) {
      best = i;
      bestDist = d;
    }
  });
  if (best < 0) return layout;
  return { ...layout, props: layout.props.filter((_, i) => i !== best) };
}

/**
 * Wall-mounted props snap to the nearest wall: position on the wall's centre line (half-cell
 * steps along it, moved `depth` into the room) and the turn that makes the prop face the room.
 */
export function nearestWallMount(
  point: { x: number; z: number },
  board: BoardSize,
  depth = 0,
): { x: number; z: number; rot: number } {
  const hw = board.width / 2;
  const hh = board.height / 2;
  const snap = (v: number, half: number) => Math.min(half, Math.max(-half, Math.round(v * 2) / 2));
  const sides = [
    {
      dist: Math.abs(point.z + hh + WALL_OFFSET),
      x: snap(point.x, hw),
      z: -(hh + WALL_OFFSET) + depth,
      rot: 0,
    },
    {
      dist: Math.abs(point.x - hw - WALL_OFFSET),
      x: hw + WALL_OFFSET - depth,
      z: snap(point.z, hh),
      rot: 6,
    },
    {
      dist: Math.abs(point.z - hh - WALL_OFFSET),
      x: snap(point.x, hw),
      z: hh + WALL_OFFSET - depth,
      rot: 4,
    },
    {
      dist: Math.abs(point.x + hw + WALL_OFFSET),
      x: -(hw + WALL_OFFSET) + depth,
      z: snap(point.z, hh),
      rot: 2,
    },
  ];
  const best = sides.reduce((a, b) => (b.dist < a.dist ? b : a));
  return { x: best.x, z: best.z, rot: best.rot };
}
