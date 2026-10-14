import { describe, expect, it } from 'vitest';
import { legalPlacements } from './dungeon';
import { createRun } from './run';
import { chooseTile, generateBossOffer, generateTileOffer } from './tiles';
import { generateSpawns } from './spawns';
import { createRng } from './rng';
import { randomBuild, testData } from './testing';

describe('tile offers', () => {
  it('createRun offers 3 tiles of different room types', () => {
    const run = createRun(testData, 11, 'mage');
    expect(run.tileOffer).toHaveLength(3);
    const types = run.tileOffer.map((t) => t.roomTypeId);
    expect(new Set(types).size).toBe(3);
    expect(types).not.toContain('boss_room');
    expect(new Set(run.tileOffer.map((t) => t.uid)).size).toBe(3);
  });

  it('the same seed gives identical offers, a different seed does not', () => {
    const a = createRun(testData, 123, 'warrior');
    const b = createRun(testData, 123, 'warrior');
    const c = createRun(testData, 124, 'warrior');
    expect(a).toEqual(b);
    expect(a.tileOffer).not.toEqual(c.tileOffer);
  });

  it('door masks have 2-4 doors in canonical order with sane frequencies', () => {
    const counts: Record<number, number> = { 2: 0, 3: 0, 4: 0 };
    let total = 0;
    for (let seed = 0; seed < 400; seed++) {
      for (const t of createRun(testData, seed, 'warrior').tileOffer) {
        counts[t.doors.length] = (counts[t.doors.length] ?? 0) + 1;
        total++;
        expect(t.doors).toEqual(['N', 'E', 'S', 'W'].filter((d) => t.doors.includes(d as never)));
      }
    }
    expect((counts[2] ?? 0) / total).toBeGreaterThan(0.4);
    expect((counts[2] ?? 0) / total).toBeLessThan(0.6);
    expect((counts[3] ?? 0) / total).toBeGreaterThan(0.27);
    expect((counts[4] ?? 0) / total).toBeGreaterThan(0.08);
    expect((counts[4] ?? 0) / total).toBeLessThan(0.23);
  });

  it('every offered tile has a legal placement (no soft lock) on 1000+ random offers', () => {
    let checked = 0;
    for (let seed = 1; seed <= 120; seed++) {
      for (const state of randomBuild(seed, 10)) {
        for (const tile of state.tileOffer) {
          expect(legalPlacements(testData, state.dungeon, tile).length).toBeGreaterThan(0);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThanOrEqual(1000);
  });

  it('falls back to a 4-door mask when rerolls cannot help', () => {
    // A dungeon where only 4-door tiles fit: start with a single door to the east at the grid edge.
    const run = createRun(testData, 9, 'warrior');
    const start = run.dungeon.rooms[run.dungeon.startKey];
    if (!start) throw new Error('no start');
    const cramped = {
      ...run,
      dungeon: {
        ...run.dungeon,
        rooms: { [run.dungeon.startKey]: { ...start, doors: ['E' as const] } },
      },
    };
    const offer = generateTileOffer(testData, cramped).tileOffer;
    for (const t of offer) {
      expect(t.doors).toContain('W');
      expect(legalPlacements(testData, cramped.dungeon, t).length).toBeGreaterThan(0);
    }
  });

  it('chooseTile moves the tile to the hand and enters Prep', () => {
    const run = createRun(testData, 3, 'rogue');
    const pick = run.tileOffer[1];
    if (!pick) throw new Error('no offer');
    const next = chooseTile(run, pick.uid);
    expect(next.phase).toBe('Prep');
    expect(next.hand).toEqual([pick]);
    expect(next.tileOffer).toEqual([]);
    expect(() => chooseTile(next, pick.uid)).toThrow();
    expect(() => chooseTile(run, 'nope')).toThrow();
  });

  it('boss offer contains boss tiles with 4 doors and no regular spawns', () => {
    const run = generateBossOffer(testData, createRun(testData, 3, 'rogue'));
    expect(run.tileOffer).toHaveLength(1);
    const boss = run.tileOffer[0];
    expect(boss?.isBoss).toBe(true);
    expect(boss?.bossId).toBe('warden');
    expect(boss?.doors).toEqual(['N', 'E', 'S', 'W']);
    expect(boss?.spawns).toEqual([]);
  });
});

describe('spawns', () => {
  const chamber = testData.roomTypes['chamber'];
  const elite = testData.roomTypes['elite_room'];
  const treasury = testData.roomTypes['treasury'];
  if (!chamber || !elite || !treasury) throw new Error('missing room types');

  it('respects base count bands per level', () => {
    const bands: [number, number, number][] = [
      [1, 2, 3],
      [3, 2, 3],
      [4, 3, 4],
      [6, 3, 4],
      [7, 4, 5],
      [11, 4, 5],
    ];
    for (const [level, min, max] of bands) {
      for (let seed = 0; seed < 100; seed++) {
        const n = generateSpawns(testData, createRng(seed), chamber, level).length;
        expect(n).toBeGreaterThanOrEqual(min);
        expect(n).toBeLessThanOrEqual(max);
      }
    }
  });

  it('brutes only appear from level 3', () => {
    for (let seed = 0; seed < 300; seed++) {
      for (const level of [1, 2]) {
        const ids = generateSpawns(testData, createRng(seed), chamber, level).map(
          (s) => s.monsterId,
        );
        expect(ids).not.toContain('brute');
      }
    }
    let seen = false;
    for (let seed = 0; seed < 300 && !seen; seed++) {
      seen = generateSpawns(testData, createRng(seed), chamber, 3).some(
        (s) => s.monsterId === 'brute',
      );
    }
    expect(seen).toBe(true);
  });

  it('elite room has exactly one elite; treasury has base - 1 (min 1) and no elites', () => {
    for (let seed = 0; seed < 50; seed++) {
      const e = generateSpawns(testData, createRng(seed), elite, 5);
      expect(e).toHaveLength(1);
      expect(e[0]?.elite).toBe(true);
      const t = generateSpawns(testData, createRng(seed), treasury, 1);
      expect(t.length).toBeGreaterThanOrEqual(1);
      expect(t.length).toBeLessThanOrEqual(2);
      expect(t.every((s) => !s.elite)).toBe(true);
    }
  });

  it('spawns are fixed per tile uid (seed from runSeed + uid)', () => {
    const a = createRun(testData, 77, 'warrior');
    const b = createRun(testData, 77, 'warrior');
    expect(a.tileOffer.map((t) => t.spawns)).toEqual(b.tileOffer.map((t) => t.spawns));
    expect(a.dungeon.rooms[a.dungeon.startKey]?.spawns.length).toBeGreaterThanOrEqual(2);
  });
});
