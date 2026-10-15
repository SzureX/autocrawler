import { describe, expect, it } from 'vitest';
import { legalPlacements, placeTile } from './dungeon';
import { chainTail, openExit } from './chain';
import { posKey } from './grid';
import { chooseTile, generateBossOffer, generateTileOffer } from './tiles';
import { createRun } from './run';
import { createRng } from './rng';
import { computeRaidRoute } from './route';
import { testData } from './testing';
import type { RunState } from './types';

/** Builds the whole chain: 10 random tiles, then the boss. Returns every state seen on the way. */
function buildChain(seed: number): RunState[] {
  const rng = createRng(seed).fork('chain-test');
  let run = createRun(testData, seed, 'warrior');
  const states: RunState[] = [run];
  for (let w = 0; w < testData.balance.wavesToBoss; w++) {
    const tile = rng.pick(run.tileOffer);
    run = chooseTile(run, tile.uid);
    const spots = legalPlacements(testData, run.dungeon, tile);
    expect(spots).toHaveLength(1);
    const [spot] = spots;
    if (!spot) break;
    run = placeTile(testData, run, tile.uid, spot);
    run = generateTileOffer(testData, { ...run, wavesWon: w + 1, phase: 'TileOffer' });
    states.push(run);
  }
  const boss = generateBossOffer(testData, { ...run, phase: 'BossOffer' });
  const bossTile = boss.tileOffer[0];
  if (!bossTile) throw new Error('no boss tile');
  run = chooseTile(boss, bossTile.uid);
  const [spot] = legalPlacements(testData, run.dungeon, bossTile);
  if (!spot) throw new Error('boss has no spot');
  states.push(placeTile(testData, run, bossTile.uid, spot));
  return states;
}

describe('one-way chain', () => {
  it('starts on the middle of the left edge with a single east door', () => {
    const run = createRun(testData, 5, 'warrior');
    expect(run.dungeon.startKey).toBe('0,4');
    expect(run.dungeon.rooms['0,4']?.doors).toEqual(['E']);
    expect(openExit(run.dungeon)).toBe('E');
  });

  it('every offer fits the single free slot and never exits west', () => {
    for (let seed = 1; seed <= 150; seed++) {
      for (const state of buildChain(seed).slice(0, -1)) {
        const tail = chainTail(state.dungeon);
        const exit = openExit(state.dungeon);
        expect(tail && exit).toBeTruthy();
        for (const tile of state.tileOffer) {
          expect(tile.doors).toHaveLength(2);
          expect(tile.doors).toContain(exit === 'E' ? 'W' : exit === 'N' ? 'S' : 'N');
          expect(legalPlacements(testData, state.dungeon, tile)).toHaveLength(1);
          const own = tile.doors.filter((d) => d !== 'W');
          expect(own.length).toBeGreaterThan(0);
        }
      }
    }
  });

  it('11 rooms plus the boss always fit and form a straight route without backtracking', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const final = buildChain(seed).at(-1);
      if (!final) throw new Error('no states');
      const rooms = Object.values(final.dungeon.rooms);
      expect(rooms).toHaveLength(12);
      expect(rooms.filter((r) => r.isBoss)).toHaveLength(1);
      const route = computeRaidRoute(final.dungeon);
      expect(route.stops).toHaveLength(12);
      expect(route.stops[0]).toBe('0,4');
      // Columns never decrease along the route.
      const xs = route.stops.map((k) => Number(k.split(',')[0]));
      for (let i = 1; i < xs.length; i++) expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] ?? 0);
      // The route is a plain walk: each stop is adjacent to the previous one.
      route.paths.slice(1).forEach((p) => expect(p).toHaveLength(2));
      expect(new Set(route.stops.map((k) => k)).size).toBe(12);
      expect(posKey(final.dungeon.rooms[route.stops[11] ?? '']?.pos ?? { x: -1, y: -1 })).toBe(
        route.stops[11],
      );
    }
  });

  it('the boss has an entrance only', () => {
    const final = buildChain(8).at(-1);
    const boss = Object.values(final?.dungeon.rooms ?? {}).find((r) => r.isBoss);
    expect(boss?.doors).toHaveLength(1);
  });
});
