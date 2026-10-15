import { describe, expect, it } from 'vitest';
import metaJson from './json/meta.json';
import balanceJson from './json/balance.json';
import classesJson from './json/classes.json';
import artifactsJson from './json/artifacts.json';
import roomTypesJson from './json/roomTypes.json';
import monstersJson from './json/monsters.json';
import bossesJson from './json/bosses.json';
import roomUpgradesJson from './json/roomUpgrades.json';
import roomLayoutsJson from './json/roomLayouts.json';
import skillTreesJson from './json/skillTrees.json';
import { DataValidationError, loadGameData, parseGameData, type RawGameData } from './loader';

const raw = (): RawGameData =>
  clone({
    meta: metaJson,
    balance: balanceJson,
    classes: classesJson,
    artifacts: artifactsJson,
    roomTypes: roomTypesJson,
    monsters: monstersJson,
    bosses: bossesJson,
    roomUpgrades: roomUpgradesJson,
    roomLayouts: roomLayoutsJson,
    skillTrees: skillTreesJson,
  });

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

describe('game data', () => {
  it('loads with the expected content counts', () => {
    const d = loadGameData();
    expect(Object.keys(d.classes)).toHaveLength(3);
    expect(Object.keys(d.artifacts)).toHaveLength(15);
    expect(Object.keys(d.monsters)).toHaveLength(4);
    expect(Object.keys(d.bosses)).toHaveLength(1);
    expect(Object.keys(d.roomTypes)).toHaveLength(6);
    expect(Object.keys(d.roomUpgrades)).toHaveLength(8);
    expect(d.balance.levelStatMultipliers).toHaveLength(11);
  });

  it('rejects duplicate ids', () => {
    const r = raw();
    (r.monsters as { id: string }[])[1]!.id = 'rat'; // index 1 exists in the bundled data
    expect(() => parseGameData(r)).toThrow(DataValidationError);
  });

  it('rejects broken references', () => {
    const r = raw();
    (r.bosses as { phase: { summonMonsterId: string } }[])[0]!.phase.summonMonsterId = 'nope';
    expect(() => parseGameData(r)).toThrow(/unknown monster/);
  });

  it('rejects schema violations', () => {
    const r = raw();
    (r.classes as { stats: { maxHp: number } }[])[0]!.stats.maxHp = -1;
    expect(() => parseGameData(r)).toThrow(DataValidationError);
  });

  it('rejects uncovered level bands', () => {
    const r = raw();
    (r.balance as { artifactDrops: unknown[] }).artifactDrops = [];
    expect(() => parseGameData(r)).toThrow(/artifactDrops/);
  });

  describe('room layouts', () => {
    const layout = (over: Record<string, unknown> = {}) => ({
      id: 'chamber_normal_1',
      name: 'Test',
      roomTypeId: 'chamber',
      doors: null,
      floors: [{ id: 'tile_small', x: 0, y: 0, rot: 0 }],
      props: [{ id: 'barrel_large', x: 1, z: 1, rot: 3 }],
      blocked: [[1, 1]],
      ...over,
    });
    const withLayouts = (layouts: unknown[]) => {
      const r = raw();
      r.roomLayouts = layouts;
      return r;
    };

    it('accepts a valid layout, normal or for exact doors', () => {
      const d = parseGameData(
        withLayouts([layout(), layout({ id: 'chamber_we_1', doors: ['E', 'W'] })]),
      );
      expect(Object.keys(d.roomLayouts)).toEqual(['chamber_normal_1', 'chamber_we_1']);
    });

    it('rejects an unknown room type, a blocked cell off the board and duplicate ids', () => {
      expect(() => parseGameData(withLayouts([layout({ roomTypeId: 'nope' })]))).toThrow(
        /unknown room type/,
      );
      expect(() => parseGameData(withLayouts([layout({ blocked: [[9, 0]] })]))).toThrow(
        /off the board/,
      );
      expect(() => parseGameData(withLayouts([layout(), layout()]))).toThrow(/Duplicate/);
    });
  });
});

type RawTree = {
  warrior: {
    nodes: {
      id: string;
      requires: string[];
      startState: string;
      position: { x: number; y: number };
    }[];
  };
};

describe('skill trees', () => {
  it('the warrior has the 9-node tree: 3 roots and 2 nodes above each', () => {
    const tree = loadGameData().skillTrees['warrior'];
    expect(tree?.nodes).toHaveLength(9);
    expect(tree?.nodes.filter((n) => n.requires.length === 0)).toHaveLength(3);
    expect(tree?.grid).toEqual({ cols: 20, rows: 15 });
    for (const n of tree?.nodes ?? []) {
      expect(n.maxLevel).toBe(1);
      expect(n.levels.map((l) => l.cost)).toEqual([1]);
    }
  });

  it('rejects a node that requires an unknown node', () => {
    const r = raw();
    (r.skillTrees as RawTree).warrior.nodes[3]!.requires = ['nope'];
    expect(() => parseGameData(r)).toThrow(/requires unknown node/);
  });

  it('rejects cycles', () => {
    const r = raw();
    const nodes = (r.skillTrees as RawTree).warrior.nodes;
    nodes[0]!.requires = ['u40'];
    nodes[0]!.startState = 'available';
    expect(() => parseGameData(r)).toThrow(/cycle/);
  });

  it('rejects nodes outside the grid and a tree of an unknown class', () => {
    const r = raw();
    (r.skillTrees as RawTree).warrior.nodes[0]!.position = { x: 99, y: 0 };
    expect(() => parseGameData(r)).toThrow(/outside the grid/);
    const r2 = raw();
    (r2.skillTrees as Record<string, unknown>)['ghost'] = (r2.skillTrees as RawTree).warrior;
    expect(() => parseGameData(r2)).toThrow(/unknown class/);
  });

  it('a root is unlocked exactly when it has no requirements', () => {
    const r = raw();
    (r.skillTrees as RawTree).warrior.nodes[3]!.startState = 'unlocked';
    expect(() => parseGameData(r)).toThrow(/unlocked exactly when/);
  });
});
