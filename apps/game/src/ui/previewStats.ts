import type { GameData } from '@loch/data';
import {
  computeHeroStats,
  computeHeroStatsFor,
  diffStats,
  equip,
  unequip,
  type RunState,
  type StatDiff,
} from '@loch/sim';

export type StatPreview =
  { kind: 'equip'; artifactUid: string; slot: number } | { kind: 'unequip'; slot: number };

/** Before/after stat differences if the given equip/unequip action were applied. */
export function previewStatDiff(data: GameData, run: RunState, preview: StatPreview): StatDiff[] {
  const before = computeHeroStats(data, run);
  try {
    const next =
      preview.kind === 'equip'
        ? equip(run, preview.artifactUid, preview.slot)
        : unequip(run, preview.slot);
    return diffStats(before, computeHeroStatsFor(data, next.classId, next.equipped));
  } catch {
    return [];
  }
}
