import type { BossDef, GameData, MonsterDef, Rarity, RoomUpgradeDef, StatBlock } from '@loch/data';
import type { SpawnSpec } from '../types';
import type { Cell, Unit } from './types';

/** Combat-relevant modifiers of a room's upgrade (CLAUDE.md 8.5). */
export interface RoomMods {
  accuracyMult: number;
  heroAspdMult: number;
  monsterMoveSpeedMult: number;
  monsterHpMult: number;
  extraMonsters: number;
  /** Multiplier of the drop weight of every monster in the room (Blood Altar). */
  dropWeightMult: number;
  /** Artifacts granted when the room is cleared; each entry is the minimum rarity. */
  clearArtifacts: Rarity[];
  healOnClearPct: number;
  guaranteedFirstCrit: boolean;
}

export function roomMods(upgrade: RoomUpgradeDef | undefined): RoomMods {
  const mods: RoomMods = {
    accuracyMult: 1,
    heroAspdMult: 1,
    monsterMoveSpeedMult: 1,
    monsterHpMult: 1,
    extraMonsters: 0,
    dropWeightMult: 1,
    clearArtifacts: [],
    healOnClearPct: 0,
    guaranteedFirstCrit: false,
  };
  if (!upgrade) return mods;
  for (const e of upgrade.effects) {
    switch (e.kind) {
      case 'accuracyMult':
        mods.accuracyMult *= e.value;
        break;
      case 'heroAspdMult':
        mods.heroAspdMult *= e.value;
        break;
      case 'monsterMoveSpeedMult':
        mods.monsterMoveSpeedMult *= e.value;
        break;
      case 'monsterHpMult':
        mods.monsterHpMult *= e.value;
        break;
      case 'extraMonster':
        mods.extraMonsters += 1;
        mods.dropWeightMult *= 1 + e.dropWeightBonus;
        break;
      case 'healOnClearPct':
        mods.healOnClearPct += e.value;
        break;
      case 'guaranteedFirstCrit':
        mods.guaranteedFirstCrit = true;
        break;
      case 'artifactOnClear':
        mods.clearArtifacts.push(e.minRarity);
        break;
    }
  }
  return mods;
}

export const cooldownTicksFor = (tickRate: number, aspd: number): number =>
  Math.max(1, Math.round(tickRate / aspd));
export const ticksPerCellFor = (tickRate: number, moveSpeed: number): number =>
  Math.max(1, Math.round(tickRate / moveSpeed));

const round2 = (v: number): number => Math.round(v * 100) / 100;

interface UnitInit {
  id: number;
  side: Unit['side'];
  monsterId: string;
  elite: boolean;
  isBoss: boolean;
  cell: Cell;
  stats: StatBlock;
  keepDistance: number;
  tickRate: number;
}

function makeUnit(init: UnitInit): Unit {
  const { stats, tickRate } = init;
  return {
    id: init.id,
    side: init.side,
    monsterId: init.monsterId,
    elite: init.elite,
    isBoss: init.isBoss,
    x: init.cell.x,
    y: init.cell.y,
    hp: stats.maxHp,
    maxHp: stats.maxHp,
    atk: stats.atk,
    def: stats.def,
    aspd: stats.aspd,
    moveSpeed: stats.moveSpeed,
    critChance: stats.critChance,
    critMult: stats.critMult,
    accuracy: stats.accuracy,
    range: stats.range,
    keepDistance: init.keepDistance,
    cooldownTicks: cooldownTicksFor(tickRate, stats.aspd),
    ticksPerCell: ticksPerCellFor(tickRate, stats.moveSpeed),
    cooldown: 0,
    moveTimer: 0,
    targetId: null,
    retargetIn: 0,
    alive: true,
    phase: 1,
  };
}

export function makeHeroUnit(data: GameData, stats: StatBlock, cell: Cell): Unit {
  return makeUnit({
    id: 0,
    side: 'hero',
    monsterId: 'hero',
    elite: false,
    isBoss: false,
    cell,
    stats,
    keepDistance: 0,
    tickRate: data.balance.combat.tickRate,
  });
}

export interface ScalingContext {
  data: GameData;
  /** HP/ATK multiplier of the dungeon level. */
  levelMult: number;
  mods: RoomMods;
}

function scaledStats(
  base: StatBlock,
  hpMult: number,
  atkMult: number,
  ctx: ScalingContext,
): StatBlock {
  return {
    ...base,
    maxHp: Math.max(1, Math.round(base.maxHp * hpMult)),
    atk: round2(base.atk * atkMult),
    moveSpeed: base.moveSpeed * ctx.mods.monsterMoveSpeedMult,
    accuracy: base.accuracy * ctx.mods.accuracyMult,
  };
}

export function makeMonsterUnit(
  ctx: ScalingContext,
  id: number,
  spec: SpawnSpec,
  def: MonsterDef,
  cell: Cell,
): Unit {
  const { elite: eliteCfg } = ctx.data.balance;
  const hpMult = ctx.levelMult * ctx.mods.monsterHpMult * (spec.elite ? eliteCfg.hpMult : 1);
  const atkMult = ctx.levelMult * (spec.elite ? eliteCfg.atkMult : 1);
  return makeUnit({
    id,
    side: 'monster',
    monsterId: def.id,
    elite: spec.elite,
    isBoss: false,
    cell,
    stats: scaledStats(def.stats, hpMult, atkMult, ctx),
    keepDistance: def.keepDistance,
    tickRate: ctx.data.balance.combat.tickRate,
  });
}

export function makeBossUnit(ctx: ScalingContext, id: number, def: BossDef, cell: Cell): Unit {
  return makeUnit({
    id,
    side: 'monster',
    monsterId: def.id,
    elite: false,
    isBoss: true,
    cell,
    stats: scaledStats(def.stats, ctx.levelMult * ctx.mods.monsterHpMult, ctx.levelMult, ctx),
    keepDistance: 0,
    tickRate: ctx.data.balance.combat.tickRate,
  });
}
