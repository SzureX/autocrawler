import type { GameData } from '@loch/data';
import { DIRS, OPPOSITE, posKey, stepPos } from './grid';
import type { DungeonState, Dir, Pos, RoomInstance, RoomTile, RunState } from './types';

export function roomAt(dungeon: DungeonState, pos: Pos): RoomInstance | undefined {
  return dungeon.rooms[posKey(pos)];
}

/** Regular (non-boss) rooms count towards the room limit. */
export function countRegularRooms(dungeon: DungeonState): number {
  return Object.values(dungeon.rooms).filter((r) => !r.isBoss).length;
}

/**
 * Keys of existing rooms that a tile with `doors` would connect to at `pos`.
 * Connection rule: the neighbour has a door towards `pos` AND the tile has a door towards it.
 * Boss rooms are dead ends and never connect to a regular tile placed later.
 */
export function placementConnections(
  dungeon: DungeonState,
  doors: readonly Dir[],
  pos: Pos,
): string[] {
  const keys: string[] = [];
  for (const dir of DIRS) {
    if (!doors.includes(dir)) continue;
    const neighbour = roomAt(dungeon, stepPos(pos, dir));
    if (neighbour && !neighbour.isBoss && neighbour.doors.includes(OPPOSITE[dir])) {
      keys.push(posKey(neighbour.pos));
    }
  }
  return keys;
}

/**
 * All legal positions for a tile, scanned row by row (y, then x) for determinism.
 * Legal: empty in-grid cell connected to at least one room; regular tiles also respect maxRooms.
 */
export function legalPlacements(
  data: GameData,
  dungeon: DungeonState,
  tile: Pick<RoomTile, 'doors' | 'isBoss'>,
): Pos[] {
  if (!tile.isBoss && countRegularRooms(dungeon) >= data.balance.maxRooms) return [];
  const result: Pos[] = [];
  for (let y = 0; y < data.balance.grid.height; y++) {
    for (let x = 0; x < data.balance.grid.width; x++) {
      const pos = { x, y };
      if (roomAt(dungeon, pos)) continue;
      if (placementConnections(dungeon, tile.doors, pos).length > 0) result.push(pos);
    }
  }
  return result;
}

/** Existing rooms connected to the room at `key`, in N,E,S,W order. */
export function connectedNeighbors(dungeon: DungeonState, key: string): string[] {
  const room = dungeon.rooms[key];
  if (!room) return [];
  const keys: string[] = [];
  for (const dir of DIRS) {
    if (!room.doors.includes(dir)) continue;
    const other = roomAt(dungeon, stepPos(room.pos, dir));
    if (other && other.doors.includes(OPPOSITE[dir])) keys.push(posKey(other.pos));
  }
  return keys;
}

/** Builds a tile from the hand onto the dungeon. Only legal in Prep. */
export function placeTile(data: GameData, run: RunState, tileUid: string, pos: Pos): RunState {
  if (run.phase !== 'Prep') throw new Error(`Cannot place a tile in phase ${run.phase}`);
  const tile = run.hand.find((t) => t.uid === tileUid);
  if (!tile) throw new Error(`Tile ${tileUid} is not in hand`);
  const legal = legalPlacements(data, run.dungeon, tile);
  if (!legal.some((p) => p.x === pos.x && p.y === pos.y)) {
    throw new Error(`Illegal placement for ${tileUid} at ${posKey(pos)}`);
  }
  const room: RoomInstance = {
    ...tile,
    pos: { x: pos.x, y: pos.y },
    order: Object.keys(run.dungeon.rooms).length,
    upgradeId: null,
  };
  return {
    ...run,
    hand: run.hand.filter((t) => t.uid !== tileUid),
    dungeon: { ...run.dungeon, rooms: { ...run.dungeon.rooms, [posKey(pos)]: room } },
  };
}
