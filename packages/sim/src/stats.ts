import type { StatBlock, StatModifier } from './types';

const STAT_KEYS: readonly (keyof StatBlock)[] = [
  'maxHp',
  'atk',
  'aspd',
  'def',
  'moveSpeed',
  'critChance',
  'critMult',
  'accuracy',
  'range',
];

/** Lower/upper bounds that keep derived stats sane (e.g. no zero attack speed). */
function clampStat(stat: keyof StatBlock, value: number): number {
  switch (stat) {
    case 'critChance':
      return Math.min(1, Math.max(0, value));
    case 'maxHp':
      return Math.max(1, value);
    case 'aspd':
    case 'moveSpeed':
      return Math.max(0.1, value);
    case 'critMult':
      return Math.max(1, value);
    case 'accuracy':
    case 'def':
      return Math.max(0, value);
    case 'atk':
      return Math.max(0, value);
    case 'range':
      return Math.max(1, value);
  }
}

/**
 * Final stats (CLAUDE.md 6.3, fixed order):
 *   final = (base + sum(flat)) * (1 + sum(percentAdd)) * product(percentMult)
 */
export function computeStats(base: StatBlock, modifiers: readonly StatModifier[]): StatBlock {
  const out = { ...base };
  for (const stat of STAT_KEYS) {
    let flat = 0;
    let add = 0;
    let mult = 1;
    for (const m of modifiers) {
      if (m.stat !== stat) continue;
      if (m.kind === 'flat') flat += m.value;
      else if (m.kind === 'percentAdd') add += m.value;
      else mult *= m.value;
    }
    out[stat] = clampStat(stat, (base[stat] + flat) * (1 + add) * mult);
  }
  return out;
}

export interface StatDiff {
  stat: keyof StatBlock;
  before: number;
  after: number;
  delta: number;
}

/** Stats that changed between two blocks (for the green/red before/after panel). */
export function diffStats(before: StatBlock, after: StatBlock): StatDiff[] {
  const diffs: StatDiff[] = [];
  for (const stat of STAT_KEYS) {
    const delta = after[stat] - before[stat];
    if (Math.abs(delta) > 1e-9) {
      diffs.push({ stat, before: before[stat], after: after[stat], delta });
    }
  }
  return diffs;
}

export { STAT_KEYS };
