import { describe, expect, it } from 'vitest';
import { createRun } from './run';
import { deserializeRun, serializeRun } from './serialize';
import {
  availableSkillPoints,
  buySkill,
  skillNodeStatus,
  skillTreeFor,
  spentSkillPoints,
} from './skills';
import { testData } from './testing';
import type { RunState } from './types';

/** A warrior in the Prep phase with the given level. */
const hero = (level: number): RunState => ({
  ...createRun(testData, 3, 'warrior'),
  phase: 'Prep',
  tileOffer: [],
  level,
});

describe('skill points', () => {
  it('there is one point for every level above the first', () => {
    expect(availableSkillPoints(testData, hero(1))).toBe(0);
    expect(availableSkillPoints(testData, hero(2))).toBe(1);
    expect(availableSkillPoints(testData, hero(10))).toBe(9);
  });

  it('spent points are subtracted and never come back', () => {
    const run = buySkill(testData, hero(4), 'u37');
    expect(spentSkillPoints(testData, run)).toBe(1);
    expect(availableSkillPoints(testData, run)).toBe(2);
  });
});

describe('buying skills', () => {
  it('a root can be bought with a free point', () => {
    const run = buySkill(testData, hero(2), 'u37');
    expect(run.skills).toEqual({ u37: 1 });
    expect(availableSkillPoints(testData, run)).toBe(0);
  });

  it('a node needs the node it is linked to, bought first', () => {
    const run = hero(5);
    expect(skillNodeStatus(testData, run, 'u40')).toMatchObject({
      block: 'locked',
      missing: ['u37'],
    });
    expect(() => buySkill(testData, run, 'u40')).toThrow(/locked/);
    const next = buySkill(testData, buySkill(testData, run, 'u37'), 'u40');
    expect(next.skills).toEqual({ u37: 1, u40: 1 });
  });

  it('refuses to buy without a free point', () => {
    expect(skillNodeStatus(testData, hero(1), 'u37').block).toBe('noPoints');
    expect(() => buySkill(testData, hero(1), 'u37')).toThrow(/noPoints/);
    const spent = buySkill(testData, hero(2), 'u37');
    expect(() => buySkill(testData, spent, 'u38')).toThrow(/noPoints/);
  });

  it('a node at its maximum level cannot be bought again', () => {
    const run = buySkill(testData, hero(5), 'u37');
    expect(skillNodeStatus(testData, run, 'u37')).toMatchObject({ block: 'maxed', cost: null });
    expect(() => buySkill(testData, run, 'u37')).toThrow(/maxed/);
  });

  it('every node costs one point', () => {
    const tree = skillTreeFor(testData, 'warrior');
    for (const node of tree?.nodes ?? []) {
      expect(node.levels.map((l) => l.cost)).toEqual([1]);
    }
  });

  it('level 10 gives exactly enough points for all nine nodes', () => {
    let run = hero(10);
    const tree = skillTreeFor(testData, 'warrior');
    const order = [...(tree?.nodes ?? [])].sort((a, b) => a.requires.length - b.requires.length);
    for (const node of order) run = buySkill(testData, run, node.id);
    expect(Object.keys(run.skills)).toHaveLength(9);
    expect(availableSkillPoints(testData, run)).toBe(0);
  });

  it('works on the Prep screen (also while a tile is offered) and nowhere else', () => {
    expect(() => buySkill(testData, { ...hero(2), phase: 'TileOffer' }, 'u37')).not.toThrow();
    expect(() => buySkill(testData, { ...hero(2), phase: 'Action' }, 'u37')).toThrow(/phase/);
    expect(() => buySkill(testData, { ...hero(2), phase: 'Resolve' }, 'u37')).toThrow(/phase/);
  });

  it('an unknown node, or a class without a tree, cannot buy anything', () => {
    expect(() => buySkill(testData, hero(5), 'nope')).toThrow(/Unknown skill node/);
    const rogue: RunState = { ...createRun(testData, 3, 'rogue'), phase: 'Prep', level: 5 };
    expect(skillTreeFor(testData, 'rogue')).toBeUndefined();
    expect(spentSkillPoints(testData, rogue)).toBe(0);
    expect(() => buySkill(testData, rogue, 'u37')).toThrow(/Unknown skill node/);
  });

  it('the bought skills survive a save', () => {
    const run = buySkill(testData, buySkill(testData, hero(4), 'u37'), 'u41');
    expect(deserializeRun(serializeRun(run)).skills).toEqual({ u37: 1, u41: 1 });
  });

  it('a new run has bought nothing', () => {
    expect(createRun(testData, 3, 'mage').skills).toEqual({});
  });
});
