import { describe, expect, it } from 'vitest';
import metaJson from './json/meta.json';
import balanceJson from './json/balance.json';
import classesJson from './json/classes.json';
import artifactsJson from './json/artifacts.json';
import roomTypesJson from './json/roomTypes.json';
import monstersJson from './json/monsters.json';
import bossesJson from './json/bosses.json';
import roomUpgradesJson from './json/roomUpgrades.json';
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
});
