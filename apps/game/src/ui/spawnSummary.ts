import type { SpawnSpec } from '@loch/sim';

export interface SpawnGroup {
  monsterId: string;
  elite: boolean;
  count: number;
}

/** Groups spawns into (monster, elite) stacks, in order of first appearance. */
export function summarizeSpawns(spawns: readonly SpawnSpec[]): SpawnGroup[] {
  const groups: SpawnGroup[] = [];
  for (const s of spawns) {
    const g = groups.find((x) => x.monsterId === s.monsterId && x.elite === s.elite);
    if (g) g.count++;
    else groups.push({ monsterId: s.monsterId, elite: s.elite, count: 1 });
  }
  return groups;
}
