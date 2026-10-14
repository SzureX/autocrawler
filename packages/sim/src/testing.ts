import { loadGameData, type GameData } from '@loch/data';
import { legalPlacements, placeTile } from './dungeon';
import { gridKey } from './grid';
import { createRng } from './rng';
import { createRun } from './run';
import { chooseTile, generateTileOffer } from './tiles';
import type { Dir, DungeonState, RoomInstance, RunState } from './types';

/** Shared game data for tests. */
export const testData: GameData = loadGameData();

/** Builds a dungeon from [x, y, doors, isBoss?] rows; the first row is the start room. */
export function makeDungeon(rows: [number, number, Dir[], boolean?][]): DungeonState {
  const rooms: Record<string, RoomInstance> = {};
  rows.forEach(([x, y, doors, isBoss], i) => {
    rooms[gridKey(x, y)] = {
      uid: `t-${i}`,
      roomTypeId: isBoss ? 'boss_room' : 'chamber',
      doors,
      spawns: [],
      isBoss: isBoss ?? false,
      pos: { x, y },
      order: i,
      upgradeId: null,
    };
  });
  const first = rows[0];
  if (!first) throw new Error('empty dungeon');
  return { rooms, startKey: gridKey(first[0], first[1]) };
}

/**
 * Plays the build loop at random (choose a random offered tile, place it at a random legal
 * position, advance a wave) and returns every intermediate state that holds a fresh offer.
 */
export function randomBuild(seed: number, waves: number): RunState[] {
  const rng = createRng(seed).fork('test-build');
  let run = createRun(testData, seed, 'warrior');
  const offers: RunState[] = [run];
  for (let w = 0; w < waves; w++) {
    const pick = rng.pick(run.tileOffer);
    run = chooseTile(run, pick.uid);
    const spots = legalPlacements(testData, run.dungeon, pick);
    if (spots.length === 0) break;
    run = placeTile(testData, run, pick.uid, rng.pick(spots));
    run = generateTileOffer(testData, { ...run, wavesWon: run.wavesWon + 1, phase: 'TileOffer' });
    offers.push(run);
  }
  return offers;
}
