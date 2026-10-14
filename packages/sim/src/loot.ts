import type { GameData, Rarity } from '@loch/data';
import { RARITIES } from '@loch/data';
import { bandValue } from './level';
import type { Rng } from './rng';

/** One planned drop, carried by a monster until it dies. */
export type DropSpec =
  { kind: 'artifact'; artifactId: string } | { kind: 'upgrade'; upgradeId: string };

const RARITY_RANK: Record<Rarity, number> = { common: 0, rare: 1, epic: 2 };

/** Rarity roll with the level's weights; `minRarity` restricts (and renormalizes) the pool. */
export function rollRarity(data: GameData, rng: Rng, level: number, minRarity?: Rarity): Rarity {
  const weights = bandValue(data.balance.rarityWeights, level);
  const allowed = RARITIES.filter((r) => !minRarity || RARITY_RANK[r] >= RARITY_RANK[minRarity]);
  return rng.weighted(allowed, (r) => weights[r]);
}

/** Artifact of the given rarity, chosen by `dropWeight`. */
export function rollArtifactId(data: GameData, rng: Rng, rarity: Rarity): string {
  const pool = Object.values(data.artifacts).filter((a) => a.rarity === rarity);
  if (pool.length === 0) throw new Error(`No artifacts of rarity ${rarity}`);
  return rng.weighted(pool, (a) => a.dropWeight).id;
}

/** A random artifact for the level, optionally of at least `minRarity`. */
export function rollArtifact(data: GameData, rng: Rng, level: number, minRarity?: Rarity): string {
  return rollArtifactId(data, rng, rollRarity(data, rng, level, minRarity));
}

export function rollUpgradeId(data: GameData, rng: Rng): string {
  return rng.pick(Object.keys(data.roomUpgrades));
}

/** Picks `count` distinct indices, each proportionally to its weight (without replacement). */
export function sampleWithoutReplacement(
  rng: Rng,
  weights: readonly number[],
  count: number,
): number[] {
  const remaining = weights.map((w, i) => ({ w, i })).filter((x) => x.w > 0);
  const picked: number[] = [];
  while (picked.length < count && remaining.length > 0) {
    const choice = rng.weighted(remaining, (x) => x.w);
    picked.push(choice.i);
    remaining.splice(remaining.indexOf(choice), 1);
  }
  return picked;
}

/**
 * Pre-rolls all drops of a raid (CLAUDE.md 6.6). `weights[i]` is the drop weight of monster i;
 * the result lists the drops carried by every monster. At most 1 artifact (and 1 upgrade)
 * per monster; counts are capped by the number of monsters.
 */
export function planDrops(
  data: GameData,
  rng: Rng,
  level: number,
  weights: readonly number[],
): DropSpec[][] {
  const plan: DropSpec[][] = weights.map(() => []);
  const [aMin, aMax] = bandValue(data.balance.artifactDrops, level);
  const artifactCount = Math.min(rng.int(aMin, aMax), weights.length);
  for (const idx of sampleWithoutReplacement(rng, weights, artifactCount)) {
    plan[idx]?.push({ kind: 'artifact', artifactId: rollArtifact(data, rng, level) });
  }
  const [uMin, uMax] = bandValue(data.balance.upgradeDrops, level);
  const upgradeCount = Math.min(rng.int(uMin, uMax), weights.length);
  for (const idx of sampleWithoutReplacement(rng, weights, upgradeCount)) {
    plan[idx]?.push({ kind: 'upgrade', upgradeId: rollUpgradeId(data, rng) });
  }
  return plan;
}
