import { describe, expect, it } from 'vitest';
import { grantArtifact } from './artifacts';
import { backpackStacks, equip, firstFreeSlot, mergeArtifacts, unequip } from './inventory';
import { createRun } from './run';
import { chooseTile } from './tiles';
import { testData } from './testing';
import type { RunState } from './types';

function prepRun(): RunState {
  const run = createRun(testData, 1, 'rogue');
  const first = run.tileOffer[0];
  if (!first) throw new Error('no offer');
  return chooseTile(run, first.uid);
}

function withArtifacts(ids: string[], level: 1 | 2 | 3 = 1): RunState {
  let run = prepRun();
  for (const id of ids) run = grantArtifact(testData, run, id, level);
  return run;
}

describe('equip / unequip', () => {
  it('moves an artifact from the backpack to a slot and back', () => {
    let run = withArtifacts(['iron_helm']);
    const uid = run.backpack[0]?.uid ?? '';
    run = equip(run, uid, 4);
    expect(run.backpack).toHaveLength(0);
    expect(run.equipped[4]?.uid).toBe(uid);
    run = unequip(run, 4);
    expect(run.equipped[4]).toBeNull();
    expect(run.backpack.map((a) => a.uid)).toEqual([uid]);
  });

  it('swaps when the slot is occupied', () => {
    let run = withArtifacts(['iron_helm', 'sharp_dagger']);
    const [a, b] = run.backpack.map((x) => x.uid);
    run = equip(run, a ?? '', 0);
    run = equip(run, b ?? '', 0);
    expect(run.equipped[0]?.uid).toBe(b);
    expect(run.backpack.map((x) => x.uid)).toEqual([a]);
  });

  it('allows duplicates in different slots and finds the first free slot', () => {
    let run = withArtifacts(['iron_helm', 'iron_helm']);
    run = equip(run, run.backpack[0]?.uid ?? '', 0);
    expect(firstFreeSlot(run)).toBe(1);
    run = equip(run, run.backpack[0]?.uid ?? '', 1);
    expect(run.equipped.filter(Boolean)).toHaveLength(2);
  });

  it('has exactly 9 slots and rejects invalid ones', () => {
    const run = withArtifacts(['iron_helm']);
    const uid = run.backpack[0]?.uid ?? '';
    expect(run.equipped).toHaveLength(9);
    expect(() => equip(run, uid, 9)).toThrow(/slot/i);
    expect(() => equip(run, uid, -1)).toThrow(/slot/i);
    expect(() => equip(run, 'nope', 0)).toThrow(/backpack/);
    expect(() => unequip(run, 0)).toThrow(/empty/);
  });

  it('only works in Prep', () => {
    const run = withArtifacts(['iron_helm']);
    const uid = run.backpack[0]?.uid ?? '';
    for (const phase of ['TileOffer', 'Action', 'Resolve'] as const) {
      expect(() => equip({ ...run, phase }, uid, 0)).toThrow(/phase/);
    }
    const equipped = equip(run, uid, 0);
    expect(() => unequip({ ...equipped, phase: 'Action' }, 0)).toThrow(/phase/);
  });

  it('can fill all 9 slots', () => {
    let run = withArtifacts(Array.from({ length: 9 }, () => 'leather_armor'));
    for (let i = 0; i < 9; i++) run = equip(run, run.backpack[0]?.uid ?? '', i);
    expect(run.backpack).toHaveLength(0);
    expect(firstFreeSlot(run)).toBeNull();
  });
});

describe('mergeArtifacts', () => {
  it('turns 3 identical level-1 artifacts into 1 level-2', () => {
    let run = withArtifacts(['iron_helm', 'iron_helm', 'iron_helm', 'sharp_dagger']);
    run = mergeArtifacts(testData, run, 'iron_helm', 1);
    expect(run.backpack.map((a) => [a.artifactId, a.level])).toEqual([
      ['sharp_dagger', 1],
      ['iron_helm', 2],
    ]);
    expect(run.stats.merges).toBe(1);
  });

  it('leaves extra copies untouched (4 -> 1 merged + 1 left)', () => {
    let run = withArtifacts(Array.from({ length: 4 }, () => 'iron_helm'));
    run = mergeArtifacts(testData, run, 'iron_helm', 1);
    expect(backpackStacks(run).map((s) => [s.level, s.count])).toEqual([
      [1, 1],
      [2, 1],
    ]);
  });

  it('level 2 -> 3, and level 3 cannot be merged', () => {
    let run = withArtifacts(['iron_helm', 'iron_helm', 'iron_helm'], 2);
    run = mergeArtifacts(testData, run, 'iron_helm', 2);
    expect(run.backpack).toHaveLength(1);
    expect(run.backpack[0]?.level).toBe(3);
    const three = withArtifacts(['iron_helm', 'iron_helm', 'iron_helm'], 3);
    expect(() => mergeArtifacts(testData, three, 'iron_helm', 3)).toThrow(/Level 3/);
  });

  it('needs at least 3 pieces', () => {
    const run = withArtifacts(['iron_helm', 'iron_helm']);
    expect(() => mergeArtifacts(testData, run, 'iron_helm', 1)).toThrow(/3/);
  });

  it('does not mix levels or artifact ids', () => {
    let run = withArtifacts(['iron_helm', 'iron_helm']);
    run = grantArtifact(testData, run, 'iron_helm', 2);
    expect(() => mergeArtifacts(testData, run, 'iron_helm', 1)).toThrow();
    const other = withArtifacts(['iron_helm', 'iron_helm', 'leather_armor']);
    expect(() => mergeArtifacts(testData, other, 'iron_helm', 1)).toThrow();
  });

  it('never uses equipped artifacts', () => {
    let run = withArtifacts(['iron_helm', 'iron_helm', 'iron_helm']);
    run = equip(run, run.backpack[0]?.uid ?? '', 0);
    expect(() => mergeArtifacts(testData, run, 'iron_helm', 1)).toThrow();
    run = unequip(run, 0);
    expect(mergeArtifacts(testData, run, 'iron_helm', 1).backpack).toHaveLength(1);
  });

  it('only works in Prep and gives the result a fresh uid', () => {
    const run = withArtifacts(['iron_helm', 'iron_helm', 'iron_helm']);
    expect(() => mergeArtifacts(testData, { ...run, phase: 'Action' }, 'iron_helm', 1)).toThrow(
      /phase/,
    );
    const merged = mergeArtifacts(testData, run, 'iron_helm', 1);
    expect(run.backpack.map((a) => a.uid)).not.toContain(merged.backpack[0]?.uid);
  });
});

describe('backpackStacks', () => {
  it('groups by id and level with counts and mergeable flags', () => {
    let run = withArtifacts(['iron_helm', 'iron_helm', 'iron_helm', 'sharp_dagger']);
    run = grantArtifact(testData, run, 'iron_helm', 2);
    const stacks = backpackStacks(run);
    expect(stacks.map((s) => [s.artifactId, s.level, s.count, s.mergeable])).toEqual([
      ['iron_helm', 1, 3, true],
      ['iron_helm', 2, 1, false],
      ['sharp_dagger', 1, 1, false],
    ]);
  });
});
