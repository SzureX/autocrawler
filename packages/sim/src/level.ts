import type { Balance } from '@loch/data';
import type { RunState } from './types';

/** Dungeon level scales monsters and loot: wavesWon + 1 (1..11). */
export function dungeonLevel(run: Pick<RunState, 'wavesWon'>): number {
  return run.wavesWon + 1;
}

interface Band<T> {
  fromLevel: number;
  toLevel: number;
  value: T;
}

/** Picks the value of the band covering `level` (the loader guarantees full coverage). */
export function bandValue<T>(bands: readonly Band<T>[], level: number): T {
  const band = bands.find((b) => b.fromLevel <= level && level <= b.toLevel);
  if (!band) throw new Error(`No balance band covers level ${level}`);
  return band.value;
}

/** HP/ATK multiplier of monsters at a dungeon level (clamped to the table). */
export function levelStatMultiplier(balance: Balance, level: number): number {
  const table = balance.levelStatMultipliers;
  const idx = Math.min(Math.max(level, 1), table.length) - 1;
  return table[idx] ?? 1;
}
