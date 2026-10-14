import type { ArtifactDef, EffectType, GameData } from '@loch/data';
import { computeStats } from './stats';
import type { ArtifactInstance, RunState, StatBlock, StatModifier } from './types';
import { mintUid } from './uid';

/** Strength multiplier of an artifact level: 1 / 2 / 4. */
export function levelMult(data: GameData, level: number): number {
  const m = data.balance.levelMult[level - 1];
  if (m === undefined) throw new Error(`Invalid artifact level: ${level}`);
  return m;
}

/** Modifiers of an artifact scaled by its level (CLAUDE.md 6.4). */
export function scaledModifiers(data: GameData, def: ArtifactDef, level: number): StatModifier[] {
  const lm = levelMult(data, level);
  return def.modifiers.map((m) => ({
    ...m,
    value: m.kind === 'percentMult' ? 1 + (m.value - 1) * lm : m.value * lm,
  }));
}

/** One active special effect of an equipped artifact (parameters already level-scaled). */
export interface ActiveEffect {
  type: EffectType;
  value: number;
  n?: number;
  threshold?: number;
  /** Equipment slot of the owning artifact; counters ("every Nth attack") are per instance. */
  slot: number;
}

export function activeEffects(
  data: GameData,
  equipped: readonly (ArtifactInstance | null)[],
): ActiveEffect[] {
  const out: ActiveEffect[] = [];
  equipped.forEach((inst, slot) => {
    if (!inst) return;
    const def = data.artifacts[inst.artifactId];
    if (!def) return;
    const lm = levelMult(data, inst.level);
    for (const e of def.effects) {
      out.push({ ...e, value: e.value * lm, slot });
    }
  });
  return out;
}

function artifactDef(data: GameData, artifactId: string): ArtifactDef {
  const def = data.artifacts[artifactId];
  if (!def) throw new Error(`Unknown artifact: ${artifactId}`);
  return def;
}

/** Hero stats for a class with the given equipment. */
export function computeHeroStatsFor(
  data: GameData,
  classId: string,
  equipped: readonly (ArtifactInstance | null)[],
): StatBlock {
  const cls = data.classes[classId];
  if (!cls) throw new Error(`Unknown class: ${classId}`);
  const mods: StatModifier[] = [];
  for (const inst of equipped) {
    if (inst) mods.push(...scaledModifiers(data, artifactDef(data, inst.artifactId), inst.level));
  }
  return computeStats(cls.stats, mods);
}

export function computeHeroStats(data: GameData, run: RunState): StatBlock {
  return computeHeroStatsFor(data, run.classId, run.equipped);
}

/** Adds one artifact to the backpack (loot, debug). */
export function grantArtifact(
  data: GameData,
  run: RunState,
  artifactId: string,
  level: 1 | 2 | 3 = 1,
): RunState {
  artifactDef(data, artifactId);
  const minted = mintUid(run, 'art');
  const inst: ArtifactInstance = { uid: minted.uid, artifactId, level };
  return {
    ...minted.run,
    backpack: [...minted.run.backpack, inst],
    stats: { ...minted.run.stats, artifactsFound: minted.run.stats.artifactsFound + 1 },
  };
}
