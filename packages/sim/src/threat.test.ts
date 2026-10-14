import { describe, expect, it } from 'vitest';
import { estimateThreat } from './threat';
import { cloneData, scenario } from './testing';
import type { SpawnSpec } from './types';

const rat: SpawnSpec = { monsterId: 'rat', elite: false };
const brute: SpawnSpec = { monsterId: 'brute', elite: false };

describe('estimateThreat', () => {
  it('is low for a couple of rats and high for a pile of brutes', () => {
    const easy = scenario({ rooms: [{ x: 4, y: 4, spawns: [rat, rat] }] });
    const hard = scenario({ rooms: [{ x: 4, y: 4, spawns: [brute, brute, brute, brute] }] });
    expect(estimateThreat(easy.data, easy.run).level).toBe('low');
    expect(estimateThreat(hard.data, hard.run).level).toBe('high');
  });

  it('grows with the dungeon level and shrinks with a stronger hero', () => {
    const rooms = [{ x: 4, y: 4, spawns: [brute, brute] }];
    const l1 = scenario({ rooms });
    const l9 = scenario({ rooms, wavesWon: 9 });
    const geared = scenario({
      rooms,
      equipment: ['iron_helm', 'leather_armor', 'rune_sword', 'sharp_dagger', 'vigor_amulet'],
    });
    const r1 = estimateThreat(l1.data, l1.run).ratio;
    expect(estimateThreat(l9.data, l9.run).ratio).toBeGreaterThan(r1);
    expect(estimateThreat(geared.data, geared.run).ratio).toBeLessThan(r1);
  });

  it('accounts for every room, elites and room upgrades', () => {
    const one = scenario({ rooms: [{ x: 4, y: 4, doors: ['E'], spawns: [brute] }] });
    const two = scenario({
      rooms: [
        { x: 4, y: 4, doors: ['E'], spawns: [brute] },
        { x: 5, y: 4, doors: ['W'], spawns: [brute] },
      ],
    });
    const elite = scenario({
      rooms: [{ x: 4, y: 4, spawns: [{ monsterId: 'brute', elite: true }] }],
    });
    const gate = scenario({ rooms: [{ x: 4, y: 4, spawns: [brute], upgradeId: 'guardian_gate' }] });
    const base = estimateThreat(one.data, one.run).ratio;
    expect(estimateThreat(two.data, two.run).ratio).toBeGreaterThan(base);
    expect(estimateThreat(elite.data, elite.run).ratio).toBeGreaterThan(base);
    expect(estimateThreat(gate.data, gate.run).ratio).toBeGreaterThan(base);
  });

  it('uses the thresholds from the data', () => {
    const { data, run } = scenario({ rooms: [{ x: 4, y: 4, spawns: [brute, brute] }] });
    const strict = cloneData((d) => {
      d.balance.threat = { mediumFrom: 0.0001, highFrom: 0.0002 };
    });
    expect(estimateThreat(strict, run).level).toBe('high');
    expect(estimateThreat(data, run).ratio).toBeGreaterThan(0);
  });
});
