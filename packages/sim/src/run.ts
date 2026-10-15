import type { GameData } from '@loch/data';
import { gridKey } from './grid';
import { generateTileOffer, createStartTile } from './tiles';
import { EQUIP_SLOTS, type RoomInstance, type RunState } from './types';

/**
 * Creates a fresh run: the chosen class, starting room #1 (a chamber with one east
 * door) in the middle of the left edge, and the first tile offer.
 */
export function createRun(data: GameData, seed: number, classId: string): RunState {
  if (!(classId in data.classes)) throw new Error(`Unknown class: ${classId}`);
  const cx = 0;
  const cy = Math.floor(data.balance.grid.height / 2);
  const startKey = gridKey(cx, cy);
  const start: RoomInstance = {
    ...createStartTile(data, seed >>> 0),
    pos: { x: cx, y: cy },
    order: 0,
    upgradeId: null,
  };
  const run: RunState = {
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
  return generateTileOffer(data, run);
}
