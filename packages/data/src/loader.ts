import { z } from 'zod';
import {
  artifactSchema,
  balanceSchema,
  bossSchema,
  classSchema,
  metaSchema,
  monsterSchema,
  roomLayoutSchema,
  skillTreeSchema,
  roomTypeSchema,
  roomUpgradeSchema,
  type GameData,
} from './schema';
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

export interface RawGameData {
  meta: unknown;
  balance: unknown;
  classes: unknown;
  artifacts: unknown;
  roomTypes: unknown;
  monsters: unknown;
  bosses: unknown;
  roomUpgrades: unknown;
  roomLayouts: unknown;
  skillTrees: unknown;
}

export class DataValidationError extends Error {}

function toRecord<T extends { id: string }>(list: T[], what: string): Record<string, T> {
  const out: Record<string, T> = {};
  for (const item of list) {
    if (item.id in out) throw new DataValidationError(`Duplicate ${what} id: ${item.id}`);
    out[item.id] = item;
  }
  return out;
}

function checkBands(
  bands: { fromLevel: number; toLevel: number }[],
  what: string,
  maxLevel: number,
): void {
  for (let lvl = 1; lvl <= maxLevel; lvl++) {
    const n = bands.filter((b) => b.fromLevel <= lvl && lvl <= b.toLevel).length;
    if (n !== 1) throw new DataValidationError(`${what}: level ${lvl} is covered ${n} times`);
  }
}

function parseWith<T extends z.ZodType>(schema: T, value: unknown, what: string): z.infer<T> {
  const res = schema.safeParse(value);
  if (!res.success) throw new DataValidationError(`${what}: ${res.error.message}`);
  return res.data;
}

/** Skill trees: known classes, unique nodes, valid links without cycles, nodes inside the grid. */
function checkSkillTrees(data: GameData): void {
  for (const [classId, tree] of Object.entries(data.skillTrees)) {
    const what = `skillTree ${classId}`;
    if (!(classId in data.classes)) throw new DataValidationError(`${what}: unknown class`);
    const byId = toRecord(tree.nodes, `${what} node`);
    for (const node of tree.nodes) {
      const { x, y } = node.position;
      if (x >= tree.grid.cols || y >= tree.grid.rows) {
        throw new DataValidationError(`${what}: node ${node.id} is outside the grid`);
      }
      for (const req of node.requires) {
        if (req === node.id || !(req in byId)) {
          throw new DataValidationError(`${what}: node ${node.id} requires unknown node ${req}`);
        }
      }
      if ((node.startState === 'unlocked') !== (node.requires.length === 0)) {
        throw new DataValidationError(
          `${what}: node ${node.id} is unlocked exactly when it has no requirements`,
        );
      }
      if (node.levels.length !== node.maxLevel) {
        throw new DataValidationError(`${what}: node ${node.id} needs ${node.maxLevel} levels`);
      }
      node.levels.forEach((l, i) => {
        if (l.level !== i + 1) {
          throw new DataValidationError(`${what}: node ${node.id} levels must count from 1`);
        }
      });
    }
    // No cycles: walk every node back to the roots.
    for (const node of tree.nodes) {
      const seen = new Set<string>();
      const walk = (id: string): void => {
        if (seen.has(id)) throw new DataValidationError(`${what}: cycle through node ${id}`);
        seen.add(id);
        for (const req of byId[id]?.requires ?? []) walk(req);
        seen.delete(id);
      };
      walk(node.id);
    }
  }
}

/** Validates raw JSON with Zod, then checks id uniqueness and cross references. */
export function parseGameData(raw: RawGameData): GameData {
  const data: GameData = {
    meta: parseWith(metaSchema, raw.meta, 'meta'),
    balance: parseWith(balanceSchema, raw.balance, 'balance'),
    classes: toRecord(parseWith(z.array(classSchema), raw.classes, 'classes'), 'class'),
    artifacts: toRecord(parseWith(z.array(artifactSchema), raw.artifacts, 'artifacts'), 'artifact'),
    roomTypes: toRecord(parseWith(z.array(roomTypeSchema), raw.roomTypes, 'roomTypes'), 'roomType'),
    monsters: toRecord(parseWith(z.array(monsterSchema), raw.monsters, 'monsters'), 'monster'),
    bosses: toRecord(parseWith(z.array(bossSchema), raw.bosses, 'bosses'), 'boss'),
    roomUpgrades: toRecord(
      parseWith(z.array(roomUpgradeSchema), raw.roomUpgrades, 'roomUpgrades'),
      'roomUpgrade',
    ),
    roomLayouts: toRecord(
      parseWith(z.array(roomLayoutSchema), raw.roomLayouts, 'roomLayouts'),
      'roomLayout',
    ),
    skillTrees: parseWith(z.record(z.string(), skillTreeSchema), raw.skillTrees, 'skillTrees'),
  };

  const maxLevel = data.balance.wavesToBoss + 1;
  if (data.balance.levelStatMultipliers.length < maxLevel) {
    throw new DataValidationError(`levelStatMultipliers needs ${maxLevel} entries`);
  }
  checkBands(data.balance.baseMonsterCount, 'baseMonsterCount', maxLevel);
  checkBands(data.balance.rarityWeights, 'rarityWeights', maxLevel);
  checkBands(data.balance.artifactDrops, 'artifactDrops', maxLevel);
  checkBands(data.balance.upgradeDrops, 'upgradeDrops', maxLevel);

  for (const boss of Object.values(data.bosses)) {
    if (!(boss.phase.summonMonsterId in data.monsters)) {
      throw new DataValidationError(
        `boss ${boss.id}: unknown monster ${boss.phase.summonMonsterId}`,
      );
    }
  }
  if (!Object.values(data.roomTypes).some((r) => r.isBoss)) {
    throw new DataValidationError('No boss room type defined');
  }
  if (!Object.values(data.roomTypes).some((r) => r.id === 'chamber' && !r.isBoss)) {
    throw new DataValidationError('Missing chamber room type');
  }
  if (Object.keys(data.bosses).length === 0) throw new DataValidationError('No bosses defined');
  const { board } = data.balance.combat;
  for (const layout of Object.values(data.roomLayouts)) {
    if (!(layout.roomTypeId in data.roomTypes)) {
      throw new DataValidationError(
        `roomLayout ${layout.id}: unknown room type ${layout.roomTypeId}`,
      );
    }
    for (const [x, y] of layout.blocked) {
      if (x >= board.width || y >= board.height) {
        throw new DataValidationError(
          `roomLayout ${layout.id}: blocked cell ${x},${y} is off the board`,
        );
      }
    }
  }
  checkSkillTrees(data);
  return data;
}

/** Loads the bundled game data and validates it. Called once at startup. */
export function loadGameData(): GameData {
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

/** All i18n keys referenced by the data (names, descriptions, traits). */
export function collectI18nKeys(data: GameData): string[] {
  const keys: string[] = [];
  for (const c of Object.values(data.classes)) keys.push(c.nameKey, c.descKey, c.traitKey);
  for (const a of Object.values(data.artifacts)) keys.push(a.nameKey, a.descKey);
  for (const r of Object.values(data.roomTypes)) keys.push(r.nameKey, r.descKey);
  for (const m of Object.values(data.monsters)) keys.push(m.nameKey);
  for (const b of Object.values(data.bosses)) keys.push(b.nameKey);
  for (const u of Object.values(data.roomUpgrades)) keys.push(u.nameKey, u.descKey);
  for (const tree of Object.values(data.skillTrees)) {
    keys.push(tree.nameKey);
    for (const n of tree.nodes) keys.push(n.nameKey, n.descKey);
  }
  return keys;
}
