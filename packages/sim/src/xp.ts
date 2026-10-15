import type { Balance } from '@loch/data';

/** The hero's progress: level and experience towards the next one. */
export interface HeroProgress {
  level: number;
  xp: number;
}

/**
 * Adds experience: every full `xpPerLevel` is a level up. At the level cap the surplus is
 * dropped and the bar stays full (`xp` equals `xpPerLevel`).
 */
export function addXp(balance: Balance, progress: HeroProgress, gained: number): HeroProgress {
  const { maxLevel, xpPerLevel } = balance.heroLevel;
  let level = Math.min(Math.max(progress.level, 1), maxLevel);
  let xp = progress.xp + Math.max(0, gained);
  while (level < maxLevel && xp >= xpPerLevel) {
    xp -= xpPerLevel;
    level++;
  }
  if (level >= maxLevel) xp = xpPerLevel;
  return { level, xp };
}

/** Skill points earned so far: one for every level above the first. */
export function earnedSkillPoints(progress: Pick<HeroProgress, 'level'>): number {
  return Math.max(0, progress.level - 1);
}
