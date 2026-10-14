import { describe, expect, it } from 'vitest';
import { summarizeSpawns } from './spawnSummary';

describe('summarizeSpawns', () => {
  it('groups by monster and elite flag', () => {
    expect(
      summarizeSpawns([
        { monsterId: 'rat', elite: false },
        { monsterId: 'skeleton', elite: false },
        { monsterId: 'rat', elite: false },
        { monsterId: 'rat', elite: true },
      ]),
    ).toEqual([
      { monsterId: 'rat', elite: false, count: 2 },
      { monsterId: 'skeleton', elite: false, count: 1 },
      { monsterId: 'rat', elite: true, count: 1 },
    ]);
  });
});
