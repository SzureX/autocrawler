import { describe, expect, it } from 'vitest';
import { computeStats, diffStats } from './stats';
import {
  activeEffects,
  computeHeroStats,
  computeHeroStatsFor,
  grantArtifact,
  scaledModifiers,
} from './artifacts';
import { equip, unequip } from './inventory';
import { createRun } from './run';
import { chooseTile } from './tiles';
import { testData } from './testing';
import type { RunState, StatBlock, StatModifier } from './types';

const base: StatBlock = {
  maxHp: 100,
  atk: 10,
  aspd: 1,
  def: 5,
  moveSpeed: 2,
  critChance: 0.1,
  critMult: 1.5,
  accuracy: 1,
  range: 1,
};

const mod = (
  stat: StatModifier['stat'],
  kind: StatModifier['kind'],
  value: number,
): StatModifier => ({
  stat,
  kind,
  value,
});

function prepRun(): RunState {
  const run = createRun(testData, 1, 'warrior');
  const first = run.tileOffer[0];
  if (!first) throw new Error('no offer');
  return chooseTile(run, first.uid);
}

describe('computeStats', () => {
  it('returns the base when there are no modifiers', () => {
    expect(computeStats(base, [])).toEqual(base);
  });

  it('flat adds to the base', () => {
    expect(computeStats(base, [mod('atk', 'flat', 3), mod('atk', 'flat', 2)]).atk).toBe(15);
  });

  it('percentAdd sums additively', () => {
    const out = computeStats(base, [mod('atk', 'percentAdd', 0.2), mod('atk', 'percentAdd', 0.3)]);
    expect(out.atk).toBeCloseTo(15);
  });

  it('percentMult multiplies', () => {
    const out = computeStats(base, [mod('atk', 'percentMult', 1.5), mod('atk', 'percentMult', 2)]);
    expect(out.atk).toBeCloseTo(30);
  });

  it('applies (base + flat) * (1 + add) * mult in that order', () => {
    const out = computeStats(base, [
      mod('maxHp', 'percentMult', 2),
      mod('maxHp', 'percentAdd', 0.5),
      mod('maxHp', 'flat', 20),
    ]);
    expect(out.maxHp).toBeCloseTo((100 + 20) * 1.5 * 2);
  });

  it('only touches the targeted stat', () => {
    const out = computeStats(base, [mod('def', 'flat', 4)]);
    expect(out).toEqual({ ...base, def: 9 });
  });

  it('clamps critChance to [0, 1] and keeps speeds positive', () => {
    expect(computeStats(base, [mod('critChance', 'flat', 5)]).critChance).toBe(1);
    expect(computeStats(base, [mod('aspd', 'percentAdd', -5)]).aspd).toBeGreaterThan(0);
  });
});

describe('diffStats', () => {
  it('lists only changed stats with deltas', () => {
    const after = computeStats(base, [mod('atk', 'flat', 3)]);
    expect(diffStats(base, after)).toEqual([{ stat: 'atk', before: 10, after: 13, delta: 3 }]);
    expect(diffStats(base, base)).toEqual([]);
  });
});

describe('level multiplier', () => {
  const dagger = testData.artifacts['sharp_dagger'];
  const ring = testData.artifacts['swift_ring'];
  const mail = testData.artifacts['guardian_mail'];
  if (!dagger || !ring || !mail) throw new Error('missing artifacts');

  it('scales flat and percentAdd by 1/2/4', () => {
    expect(scaledModifiers(testData, dagger, 1)[0]?.value).toBe(3);
    expect(scaledModifiers(testData, dagger, 2)[0]?.value).toBe(6);
    expect(scaledModifiers(testData, dagger, 3)[0]?.value).toBe(12);
    expect(scaledModifiers(testData, ring, 3)[0]?.value).toBeCloseTo(0.6);
    expect(scaledModifiers(testData, mail, 2).map((m) => m.value)).toEqual([12, 0.2]);
  });

  it('scales percentMult as 1 + (v - 1) * levelMult', () => {
    const synthetic = { ...dagger, modifiers: [mod('atk', 'percentMult', 1.1)] };
    expect(scaledModifiers(testData, synthetic, 1)[0]?.value).toBeCloseTo(1.1);
    expect(scaledModifiers(testData, synthetic, 2)[0]?.value).toBeCloseTo(1.2);
    expect(scaledModifiers(testData, synthetic, 3)[0]?.value).toBeCloseTo(1.4);
  });

  it('rejects invalid levels', () => {
    expect(() => scaledModifiers(testData, dagger, 4)).toThrow();
  });
});

describe('hero stats', () => {
  it('start from the class base', () => {
    const run = createRun(testData, 1, 'warrior');
    expect(computeHeroStats(testData, run)).toEqual(testData.classes['warrior']?.stats);
  });

  it('change immediately when the equipment changes', () => {
    let run = prepRun();
    const before = computeHeroStats(testData, run);
    run = grantArtifact(testData, run, 'sharp_dagger');
    expect(computeHeroStats(testData, run).atk).toBe(before.atk); // backpack does not count
    const uid = run.backpack[0]?.uid ?? '';
    run = equip(run, uid, 0);
    expect(computeHeroStats(testData, run).atk).toBe(before.atk + 3);
    run = unequip(run, 0);
    expect(computeHeroStats(testData, run).atk).toBe(before.atk);
  });

  it('stacks several artifacts through the fixed order', () => {
    // warrior: 120 hp. helm +20 flat, amulet +15% -> (120+20)*1.15
    let run = prepRun();
    run = grantArtifact(testData, run, 'iron_helm');
    run = grantArtifact(testData, run, 'vigor_amulet');
    run = equip(run, run.backpack[0]?.uid ?? '', 0);
    run = equip(run, run.backpack[0]?.uid ?? '', 1);
    expect(computeHeroStats(testData, run).maxHp).toBeCloseTo(140 * 1.15);
  });

  it('a level 3 artifact is 4x as strong', () => {
    const warrior = testData.classes['warrior']?.stats;
    if (!warrior) throw new Error('no class');
    const stats = computeHeroStatsFor(testData, 'warrior', [
      { uid: 'x', artifactId: 'leather_armor', level: 3 },
      ...Array.from({ length: 8 }, () => null),
    ]);
    expect(stats.def).toBe(warrior.def + 12);
  });

  it('collects effects per equipped instance with scaled values', () => {
    const effects = activeEffects(testData, [
      { uid: 'a', artifactId: 'vampire_stone', level: 2 },
      null,
      { uid: 'b', artifactId: 'echo_hammer', level: 1 },
      { uid: 'c', artifactId: 'echo_hammer', level: 3 },
    ]);
    expect(effects).toEqual([
      { type: 'lifesteal', value: 0.1, slot: 0 },
      { type: 'everyNthAttack', value: 1, n: 5, slot: 2 },
      { type: 'everyNthAttack', value: 4, n: 5, slot: 3 },
    ]);
  });
});
