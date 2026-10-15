import type { GameData } from '@loch/data';
import { OPPOSITE, posKey, stepPos } from './grid';
import type { Dir, DungeonState, Pos, RoomInstance } from './types';

/**
 * The dungeon is a one-way chain: every room has one entrance and (except the boss) one exit.
 * An exit never points west, so the chain can never turn back into an earlier column.
 */
export const FORWARD_DIRS: readonly Dir[] = ['N', 'E', 'S'];

function inGrid(data: GameData, pos: Pos): boolean {
  return (
    pos.x >= 0 && pos.y >= 0 && pos.x < data.balance.grid.width && pos.y < data.balance.grid.height
  );
}

/** The last regular room built (highest `order`), i.e. the end of the chain. */
export function chainTail(dungeon: DungeonState): RoomInstance | undefined {
  let tail: RoomInstance | undefined;
  for (const room of Object.values(dungeon.rooms)) {
    if (room.isBoss) continue;
    if (!tail || room.order > tail.order) tail = room;
  }
  return tail;
}

/** The tail's door that does not lead to a built room yet (the exit the next tile attaches to). */
export function openExit(dungeon: DungeonState): Dir | null {
  const tail = chainTail(dungeon);
  if (!tail) return null;
  return tail.doors.find((d) => !dungeon.rooms[posKey(stepPos(tail.pos, d))]) ?? null;
}

/** Number of tiles still to build including the boss (0 once the boss stands). */
export function tilesLeft(data: GameData, dungeon: DungeonState): number {
  const rooms = Object.values(dungeon.rooms);
  if (rooms.some((r) => r.isBoss)) return 0;
  return Math.max(0, data.balance.wavesToBoss + 1 - rooms.length) + 1;
}

/** True when a tile at `cell` (entered through `entrance`) can still be followed up to the boss. */
function canFinish(
  data: GameData,
  cell: Pos,
  entrance: Dir,
  remaining: number,
  taken: Record<string, boolean>,
): boolean {
  if (remaining <= 1) return true;
  taken[posKey(cell)] = true;
  let ok = false;
  for (const dir of FORWARD_DIRS) {
    if (dir === entrance) continue;
    const next = stepPos(cell, dir);
    if (!inGrid(data, next) || taken[posKey(next)]) continue;
    if (canFinish(data, next, OPPOSITE[dir], remaining - 1, taken)) {
      ok = true;
      break;
    }
  }
  delete taken[posKey(cell)];
  return ok;
}

/**
 * Exits a tile placed at `cell` (entered through `entrance`) may have so that the chain can still
 * be completed: `remaining` is the number of tiles left to build including this one and the boss.
 */
export function feasibleExits(
  data: GameData,
  cell: Pos,
  entrance: Dir,
  remaining: number,
  taken: Record<string, boolean>,
): Dir[] {
  if (remaining <= 1) return [];
  const scratch = { ...taken, [posKey(cell)]: true };
  return FORWARD_DIRS.filter((dir) => {
    if (dir === entrance) return false;
    const next = stepPos(cell, dir);
    if (!inGrid(data, next) || scratch[posKey(next)]) return false;
    return canFinish(data, next, OPPOSITE[dir], remaining - 1, scratch);
  });
}

/** Where the next tile goes and which side its entrance must face; null when the chain is closed. */
export function nextSlot(
  data: GameData,
  dungeon: DungeonState,
): { cell: Pos; entrance: Dir } | null {
  const tail = chainTail(dungeon);
  const exit = openExit(dungeon);
  if (!tail || !exit) return null;
  const cell = stepPos(tail.pos, exit);
  if (!inGrid(data, cell) || dungeon.rooms[posKey(cell)]) return null;
  return { cell, entrance: OPPOSITE[exit] };
}

/** Occupied cells as a lookup, for `feasibleExits`. */
export function takenCells(dungeon: DungeonState): Record<string, boolean> {
  const taken: Record<string, boolean> = {};
  for (const key of Object.keys(dungeon.rooms)) taken[key] = true;
  return taken;
}
