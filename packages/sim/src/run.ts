import type { GameData } from '@loch/data';
import { EQUIP_SLOTS, type RoomInstance, type RunState } from './types';

export function gridKey(x: number, y: number): string {
  return `${x},${y}`;
}

/** Mints a unique id and returns the updated counter. */
export function mintUid(run: RunState, prefix: string): { uid: string; run: RunState } {
  return { uid: `${prefix}-${run.nextUid}`, run: { ...run, nextUid: run.nextUid + 1 } };
}

/**
 * Creates a fresh run: the chosen class, starting room #1 (a chamber with all four
 * doors) in the middle of the grid. The first tile offer is generated in M1.
 */
export function createRun(data: GameData, seed: number, classId: string): RunState {
  if (!(classId in data.classes)) throw new Error(`Unknown class: ${classId}`);
  const cx = Math.floor(data.balance.grid.width / 2);
  const cy = Math.floor(data.balance.grid.height / 2);
  const startKey = gridKey(cx, cy);
  const start: RoomInstance = {
    uid: 'tile-0',
    roomTypeId: 'chamber',
    doors: ['N', 'E', 'S', 'W'],
    spawns: [],
    isBoss: false,
    pos: { x: cx, y: cy },
    order: 0,
    upgradeId: null,
  };
  return {
    saveVersion: data.meta.saveVersion,
    seed: seed >>> 0,
    classId,
    phase: 'TileOffer',
    lives: data.balance.startLives,
    wavesWon: 0,
    raidAttempts: 0,
    dungeon: { rooms: { [startKey]: start }, startKey },
    hand: [],
    tileOffer: [],
    backpack: [],
    equipped: Array.from({ length: EQUIP_SLOTS }, () => null),
    upgradeStorage: [],
    lastRaid: null,
    stats: { raids: 0, wins: 0, losses: 0, merges: 0, artifactsFound: 0 },
    nextUid: 1,
  };
}
