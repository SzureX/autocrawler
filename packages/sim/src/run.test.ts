import { describe, expect, it } from 'vitest';
import { loadGameData } from '@loch/data';
import {
  RUN_PHASES,
  RunParseError,
  allowedTransitions,
  canTransition,
  createRun,
  deserializeRun,
  serializeRun,
  setPhase,
} from './index';

const data = loadGameData();

describe('createRun', () => {
  it('creates the starting state', () => {
    const run = createRun(data, 42, 'warrior');
    expect(run.phase).toBe('TileOffer');
    expect(run.lives).toBe(5);
    expect(run.wavesWon).toBe(0);
    expect(run.equipped).toHaveLength(9);
    expect(Object.keys(run.dungeon.rooms)).toEqual(['4,4']);
    expect(run.dungeon.rooms['4,4']?.doors).toEqual(['N', 'E', 'S', 'W']);
    expect(run.dungeon.startKey).toBe('4,4');
  });

  it('rejects unknown classes', () => {
    expect(() => createRun(data, 1, 'bard')).toThrow();
  });
});

describe('serialization', () => {
  it('round-trips through JSON', () => {
    const run = createRun(data, 99, 'mage');
    const back = deserializeRun(serializeRun(run));
    expect(back).toEqual(run);
  });

  it('survives a populated state', () => {
    const base = createRun(data, 99, 'rogue');
    const run = {
      ...base,
      backpack: [{ uid: 'a-1', artifactId: 'iron_helm', level: 2 as const }],
      equipped: base.equipped.map((_, i) =>
        i === 0 ? { uid: 'a-2', artifactId: 'sharp_dagger', level: 1 as const } : null,
      ),
      upgradeStorage: ['fountain'],
    };
    expect(deserializeRun(serializeRun(run))).toEqual(run);
  });

  it('rejects garbage, wrong shapes and unknown versions', () => {
    expect(() => deserializeRun('not json')).toThrow(RunParseError);
    expect(() => deserializeRun('{"saveVersion":1}')).toThrow(RunParseError);
    const run = createRun(data, 1, 'warrior');
    expect(() => deserializeRun(JSON.stringify({ ...run, saveVersion: 999 }))).toThrow(
      RunParseError,
    );
    expect(() => deserializeRun(JSON.stringify({ ...run, equipped: [] }))).toThrow(RunParseError);
  });
});

describe('phase machine', () => {
  it('allows the main loop and rejects shortcuts', () => {
    expect(canTransition('TileOffer', 'Prep')).toBe(true);
    expect(canTransition('Prep', 'Action')).toBe(true);
    expect(canTransition('Action', 'Resolve')).toBe(true);
    expect(canTransition('Prep', 'Resolve')).toBe(false);
    expect(canTransition('Action', 'Prep')).toBe(false);
    expect(allowedTransitions('Victory')).toEqual([]);
    expect(allowedTransitions('GameOver')).toEqual([]);
  });

  it('setPhase is pure and throws on illegal moves', () => {
    const run = createRun(data, 1, 'warrior');
    const next = setPhase(run, 'Prep');
    expect(next.phase).toBe('Prep');
    expect(run.phase).toBe('TileOffer');
    expect(() => setPhase(run, 'Action')).toThrow();
  });

  it('every phase has a transition entry', () => {
    for (const p of RUN_PHASES) expect(Array.isArray(allowedTransitions(p))).toBe(true);
  });
});
