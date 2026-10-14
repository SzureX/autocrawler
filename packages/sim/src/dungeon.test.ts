import { describe, expect, it } from 'vitest';
import { connectedNeighbors, countRegularRooms, legalPlacements, placeTile } from './dungeon';
import { createRun } from './run';
import { chooseTile } from './tiles';
import { makeDungeon, testData } from './testing';
import type { Dir } from './types';

const key = (p: { x: number; y: number }): string => `${p.x},${p.y}`;
const legal = (dungeon: ReturnType<typeof makeDungeon>, doors: Dir[], isBoss = false): string[] =>
  legalPlacements(testData, dungeon, { doors, isBoss }).map(key);

describe('legalPlacements', () => {
  const single = makeDungeon([[4, 4, ['N', 'E', 'S', 'W']]]);

  it('requires the tile to have a door towards the neighbour and vice versa', () => {
    // Tile placed north of the start (y=3) must have an S door; the start has N.
    expect(legal(single, ['S', 'N'])).toContain('4,3');
    expect(legal(single, ['E', 'W'])).not.toContain('4,3');
    // A tile with only N/S doors can only connect vertically.
    expect(legal(single, ['N', 'S']).sort()).toEqual(['4,3', '4,5']);
    // Tile east of start needs W.
    expect(legal(single, ['W', 'N'])).toContain('5,4');
  });

  it('rejects cells whose neighbour has no matching door', () => {
    const d = makeDungeon([[4, 4, ['E']]]);
    // Only the cell east of the start is reachable, and only with a W door.
    expect(legal(d, ['W', 'E'])).toEqual(['5,4']);
    expect(legal(d, ['N', 'S'])).toEqual([]);
  });

  it('excludes occupied cells and cells outside the grid', () => {
    const d = makeDungeon([
      [0, 0, ['E', 'S']],
      [1, 0, ['W', 'S']],
    ]);
    const spots = legal(d, ['N', 'W', 'E', 'S']);
    expect(spots).not.toContain('0,0');
    expect(spots).not.toContain('1,0');
    expect(spots).not.toContain('0,-1');
    expect(spots).toEqual(expect.arrayContaining(['0,1', '1,1']));
  });

  it('connects to every matching neighbour (cycles possible)', () => {
    const d = makeDungeon([
      [3, 4, ['E', 'S']],
      [3, 5, ['N', 'E']],
      [4, 5, ['W', 'E', 'N']],
      [5, 5, ['W', 'N']],
      [5, 4, ['S', 'W']],
    ]);
    const doors: Dir[] = ['E', 'S', 'W'];
    expect(legal(d, doors)).toContain('4,4');
    const tile = { ...makeTileFor(doors) };
    const run = {
      ...createRun(testData, 1, 'warrior'),
      phase: 'Prep' as const,
      dungeon: d,
      hand: [tile],
    };
    const next = placeTile(testData, run, tile.uid, { x: 4, y: 4 });
    expect(connectedNeighbors(next.dungeon, '4,4')).toEqual(['5,4', '4,5', '3,4']);
  });

  it('scans deterministically row by row', () => {
    const spots = legal(single, ['N', 'E', 'S', 'W']);
    expect(spots).toEqual(['4,3', '3,4', '5,4', '4,5']);
  });

  it('respects the room limit for regular tiles but not for the boss', () => {
    const rows: [number, number, Dir[]][] = [[0, 0, ['E', 'S', 'N', 'W']]];
    for (let i = 1; i < testData.balance.maxRooms; i++) {
      rows.push([i % 9, Math.floor(i / 9) + (i >= 9 ? 1 : 0), ['E', 'S', 'N', 'W']]);
    }
    const full = makeDungeon(rows);
    expect(countRegularRooms(full)).toBe(15);
    expect(legalPlacements(testData, full, { doors: ['N', 'E', 'S', 'W'], isBoss: false })).toEqual(
      [],
    );
    expect(
      legalPlacements(testData, full, { doors: ['N', 'E', 'S', 'W'], isBoss: true }).length,
    ).toBeGreaterThan(0);
  });
});

function makeTileFor(doors: Dir[]) {
  return { uid: 'tile-x', roomTypeId: 'chamber', doors, spawns: [], isBoss: false };
}

describe('placeTile', () => {
  const base = chooseTile(
    createRun(testData, 5, 'warrior'),
    createRun(testData, 5, 'warrior').tileOffer[0]?.uid ?? '',
  );

  it('puts the tile in the dungeon, empties the hand and numbers the room', () => {
    const tile = base.hand[0];
    expect(tile).toBeDefined();
    if (!tile) return;
    const spot = legalPlacements(testData, base.dungeon, tile)[0];
    expect(spot).toBeDefined();
    if (!spot) return;
    const next = placeTile(testData, base, tile.uid, spot);
    expect(next.hand).toEqual([]);
    expect(next.dungeon.rooms[key(spot)]?.order).toBe(1);
    expect(Object.keys(next.dungeon.rooms)).toHaveLength(2);
    expect(base.hand).toHaveLength(1); // input untouched
  });

  it('rejects illegal positions, unknown tiles and wrong phases', () => {
    const tile = base.hand[0];
    if (!tile) throw new Error('no tile');
    expect(() => placeTile(testData, base, tile.uid, { x: 0, y: 0 })).toThrow(/Illegal/);
    expect(() => placeTile(testData, base, tile.uid, { x: 4, y: 4 })).toThrow(/Illegal/);
    expect(() => placeTile(testData, base, 'nope', { x: 4, y: 3 })).toThrow(/not in hand/);
    expect(() =>
      placeTile(testData, { ...base, phase: 'Action' }, tile.uid, { x: 4, y: 3 }),
    ).toThrow(/phase/);
  });
});
