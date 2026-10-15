import { parseGameData } from './loader';
import type { GameData } from './schema';
import metaJson from './fixtures/meta.json';
import balanceJson from './fixtures/balance.json';
import classesJson from './fixtures/classes.json';
import artifactsJson from './fixtures/artifacts.json';
import roomTypesJson from './fixtures/roomTypes.json';
import monstersJson from './fixtures/monsters.json';
import bossesJson from './fixtures/bosses.json';
import roomUpgradesJson from './fixtures/roomUpgrades.json';
import roomLayoutsJson from './fixtures/roomLayouts.json';
import skillTreesJson from './fixtures/skillTrees.json';

/**
 * The original values from CLAUDE.md section 8, frozen. Mechanic tests use these so that
 * balance tuning in `json/` never changes what the tests expect. The shipped game uses
 * `loadGameData()`.
 */
export function loadSpecGameData(): GameData {
  return parseGameData({
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
}
