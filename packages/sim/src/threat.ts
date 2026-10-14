import type { GameData } from '@loch/data';
import { computeHeroStats } from './artifacts';
import { roomMods } from './combat/units';
import { dungeonLevel, levelStatMultiplier } from './level';
import type { RunState } from './types';

export type ThreatLevel = 'low' | 'medium' | 'high';

export interface ThreatEstimate {
  level: ThreatLevel;
  /** Estimated damage the hero takes divided by his max HP (>= 1 means likely defeat). */
  ratio: number;
  monsterHp: number;
  heroDps: number;
  heroHp: number;
}

/**
 * Rough danger of the current dungeon for the current hero (3 steps). It sums the monsters of
 * every room (with level scaling and upgrades) and compares the damage they would deal while the
 * hero kills them one room at a time with his HP. It is an aid for decisions, not a prediction.
 */
export function estimateThreat(data: GameData, run: RunState): ThreatEstimate {
  const hero = computeHeroStats(data, run);
  const cls = data.classes[run.classId];
  const mult = levelStatMultiplier(data.balance, dungeonLevel(run));
  const crit = 1 + hero.critChance * (hero.critMult - 1);
  const aoe = cls?.trait.kind === 'aoe' ? 1 + cls.trait.value : 1;

  let totalHp = 0;
  let totalDamage = 0;

  for (const room of Object.values(run.dungeon.rooms)) {
    const mods = roomMods(room.upgradeId ? data.roomUpgrades[room.upgradeId] : undefined);
    const units: { hp: number; atk: number; aspd: number; def: number }[] = [];
    for (const s of room.spawns) {
      const def = data.monsters[s.monsterId];
      if (!def) continue;
      const e = s.elite ? data.balance.elite : { hpMult: 1, atkMult: 1 };
      units.push({
        hp: def.stats.maxHp * mult * e.hpMult * mods.monsterHpMult,
        atk: def.stats.atk * mult * e.atkMult,
        aspd: def.stats.aspd,
        def: def.stats.def,
      });
    }
    if (room.bossId) {
      const boss = data.bosses[room.bossId];
      if (boss) {
        units.push({
          hp: boss.stats.maxHp * mult * mods.monsterHpMult,
          atk: boss.stats.atk * mult,
          aspd: boss.stats.aspd * 1.15,
          def: boss.stats.def,
        });
      }
    }
    const first = units[0];
    const extra = mods.extraMonsters > 0 && first ? mods.extraMonsters : 0;
    for (let i = 0; i < extra && first; i++) units.push({ ...first });
    if (units.length === 0) continue;

    const roomHp = units.reduce((a, u) => a + u.hp, 0);
    const avgDef = units.reduce((a, u) => a + u.def, 0) / units.length;
    const heroDps = Math.max(0.01, ((hero.atk * 100) / (100 + avgDef)) * hero.aspd * crit * aoe);
    const roomDps = units.reduce((a, u) => a + ((u.atk * 100) / (100 + hero.def)) * u.aspd, 0);
    const ttk = roomHp / heroDps;
    totalHp += roomHp;

    // Monsters die one by one, so on average about half of them are alive during the fight.
    totalDamage += roomDps * ttk * 0.5;
  }
  const heroDpsOverall = totalHp > 0 ? hero.atk * hero.aspd * crit * aoe : 0;
  const ratio = totalDamage / hero.maxHp;
  const { mediumFrom, highFrom } = data.balance.threat;
  return {
    level: ratio >= highFrom ? 'high' : ratio >= mediumFrom ? 'medium' : 'low',
    ratio,
    monsterHp: totalHp,
    heroDps: heroDpsOverall,
    heroHp: hero.maxHp,
  };
}
