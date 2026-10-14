import type { GameData } from '@loch/data';
import { EQUIP_SLOTS, type ArtifactInstance, type RunState } from './types';
import { mintUid } from './uid';

function requirePrep(run: RunState, what: string): void {
  if (run.phase !== 'Prep') throw new Error(`Cannot ${what} in phase ${run.phase}`);
}

function checkSlot(slot: number): void {
  if (!Number.isInteger(slot) || slot < 0 || slot >= EQUIP_SLOTS) {
    throw new Error(`Invalid slot: ${slot}`);
  }
}

export function firstFreeSlot(run: Pick<RunState, 'equipped'>): number | null {
  const idx = run.equipped.findIndex((s) => s === null);
  return idx === -1 ? null : idx;
}

/** Equips a backpack artifact into a slot. An occupied slot is swapped back to the backpack. */
export function equip(run: RunState, artifactUid: string, slot: number): RunState {
  requirePrep(run, 'equip');
  checkSlot(slot);
  const inst = run.backpack.find((a) => a.uid === artifactUid);
  if (!inst) throw new Error(`Artifact ${artifactUid} is not in the backpack`);
  const previous = run.equipped[slot] ?? null;
  const backpack = run.backpack.filter((a) => a.uid !== artifactUid);
  if (previous) backpack.push(previous);
  const equipped = run.equipped.map((s, i) => (i === slot ? inst : s));
  return { ...run, backpack, equipped };
}

/** Moves the artifact in a slot back to the backpack. */
export function unequip(run: RunState, slot: number): RunState {
  requirePrep(run, 'unequip');
  checkSlot(slot);
  const inst = run.equipped[slot];
  if (!inst) throw new Error(`Slot ${slot} is empty`);
  return {
    ...run,
    backpack: [...run.backpack, inst],
    equipped: run.equipped.map((s, i) => (i === slot ? null : s)),
  };
}

/**
 * Merges 3 backpack artifacts with the same id and level into 1 of the next level.
 * Equipped artifacts are never used; max level is 3.
 */
export function mergeArtifacts(
  data: GameData,
  run: RunState,
  artifactId: string,
  level: 1 | 2 | 3,
): RunState {
  requirePrep(run, 'merge');
  if (!(artifactId in data.artifacts)) throw new Error(`Unknown artifact: ${artifactId}`);
  if (level >= 3) throw new Error('Level 3 artifacts cannot be merged');
  const matching = run.backpack.filter((a) => a.artifactId === artifactId && a.level === level);
  if (matching.length < 3) throw new Error('Need 3 identical artifacts of the same level');
  const used = matching.slice(0, 3).map((a) => a.uid);
  const minted = mintUid(run, 'art');
  const merged: ArtifactInstance = {
    uid: minted.uid,
    artifactId,
    level: (level + 1) as 2 | 3,
  };
  return {
    ...minted.run,
    backpack: [...minted.run.backpack.filter((a) => !used.includes(a.uid)), merged],
    stats: { ...minted.run.stats, merges: minted.run.stats.merges + 1 },
  };
}

export interface BackpackStack {
  artifactId: string;
  level: 1 | 2 | 3;
  count: number;
  uids: string[];
  mergeable: boolean;
}

/** Backpack grouped into stacks (same artifact id and level), sorted by id then level. */
export function backpackStacks(run: Pick<RunState, 'backpack'>): BackpackStack[] {
  const stacks: BackpackStack[] = [];
  for (const a of run.backpack) {
    const s = stacks.find((x) => x.artifactId === a.artifactId && x.level === a.level);
    if (s) {
      s.count++;
      s.uids.push(a.uid);
    } else {
      stacks.push({
        artifactId: a.artifactId,
        level: a.level,
        count: 1,
        uids: [a.uid],
        mergeable: false,
      });
    }
  }
  for (const s of stacks) s.mergeable = s.count >= 3 && s.level < 3;
  return stacks.sort((a, b) =>
    a.artifactId === b.artifactId ? a.level - b.level : a.artifactId < b.artifactId ? -1 : 1,
  );
}
