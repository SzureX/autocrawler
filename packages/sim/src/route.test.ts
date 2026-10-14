import { describe, expect, it } from 'vitest';
import { connectedNeighbors } from './dungeon';
import { computeRaidRoute } from './route';
import { chooseTile, generateBossOffer } from './tiles';
import { placeTile, legalPlacements } from './dungeon';
import { makeDungeon, randomBuild, testData } from './testing';
import { createRng } from './rng';
import type { DungeonState } from './types';

function checkRoute(dungeon: DungeonState): void {
  const route = computeRaidRoute(dungeon);
  const keys = Object.keys(dungeon.rooms);
  // Every room visited exactly once, start first.
  expect([...route.stops].sort()).toEqual([...keys].sort());
  expect(route.stops[0]).toBe(dungeon.startKey);
  expect(route.paths).toHaveLength(route.stops.length);
  expect(route.paths[0]).toEqual([dungeon.startKey]);
  // Boss last and never an intermediate step.
  const boss = Object.values(dungeon.rooms).find((r) => r.isBoss);
  if (boss) {
    expect(route.stops[route.stops.length - 1]).toBe(`${boss.pos.x},${boss.pos.y}`);
  }
  route.paths.forEach((path, i) => {
    if (i === 0) return;
    expect(path[0]).toBe(route.stops[i - 1]);
    expect(path[path.length - 1]).toBe(route.stops[i]);
    for (let s = 1; s < path.length; s++) {
      const a = path[s - 1];
      const b = path[s];
      if (a === undefined || b === undefined) throw new Error('bad path');
      expect(connectedNeighbors(dungeon, a)).toContain(b);
      if (s < path.length - 1) expect(dungeon.rooms[b]?.isBoss).toBe(false);
    }
  });
}

describe('computeRaidRoute', () => {
  it('single room', () => {
    const d = makeDungeon([[4, 4, ['N']]]);
    expect(computeRaidRoute(d)).toEqual({ stops: ['4,4'], paths: [['4,4']] });
  });

  it('line: visits in order, then backtracking is part of paths', () => {
    const d = makeDungeon([
      [4, 4, ['E']],
      [5, 4, ['W', 'E']],
      [6, 4, ['W']],
    ]);
    const r = computeRaidRoute(d);
    expect(r.stops).toEqual(['4,4', '5,4', '6,4']);
    expect(r.paths).toEqual([['4,4'], ['4,4', '5,4'], ['5,4', '6,4']]);
  });

  it('branches follow N,E,S,W order and backtrack through cleared rooms', () => {
    // Start with N and E branches: N first, then back through start to E.
    const d = makeDungeon([
      [4, 4, ['N', 'E']],
      [4, 3, ['S']],
      [5, 4, ['W']],
    ]);
    const r = computeRaidRoute(d);
    expect(r.stops).toEqual(['4,4', '4,3', '5,4']);
    expect(r.paths[2]).toEqual(['4,3', '4,4', '5,4']);
  });

  it('cycle: each room is visited once, paths take the shortest way', () => {
    const d = makeDungeon([
      [4, 4, ['E', 'S']],
      [5, 4, ['W', 'S']],
      [5, 5, ['N', 'W']],
      [4, 5, ['E', 'N']],
    ]);
    const r = computeRaidRoute(d);
    expect(r.stops).toEqual(['4,4', '5,4', '5,5', '4,5']);
    checkRoute(d);
  });

  it('boss is last, a dead end, and never walked through', () => {
    // Boss at (5,4) touches the start; room (6,4) is reachable only around via (5,5)... via start.
    const d = makeDungeon([
      [4, 4, ['E', 'S']],
      [4, 5, ['N', 'E']],
      [5, 5, ['W', 'N']],
      [5, 4, ['W', 'S', 'E', 'N'], true],
    ]);
    const r = computeRaidRoute(d);
    expect(r.stops[r.stops.length - 1]).toBe('5,4');
    expect(r.stops).toEqual(['4,4', '4,5', '5,5', '5,4']);
    checkRoute(d);
  });

  it('is valid on 20+ generated layouts (with and without boss)', () => {
    let layouts = 0;
    for (let seed = 1; seed <= 25; seed++) {
      const states = randomBuild(seed, 10);
      const last = states[states.length - 1];
      if (!last) continue;
      checkRoute(last.dungeon);
      layouts++;
      // Add the boss on top.
      let run = generateBossOffer(testData, { ...last, wavesWon: 10, phase: 'BossOffer' });
      const boss = run.tileOffer[0];
      if (!boss) continue;
      run = chooseTile(run, boss.uid);
      const spots = legalPlacements(testData, run.dungeon, boss);
      const spot = createRng(seed).pick(spots);
      run = placeTile(testData, run, boss.uid, spot);
      checkRoute(run.dungeon);
      layouts++;
    }
    expect(layouts).toBeGreaterThanOrEqual(20);
  });
});
