import type { GameData, RoomTypeDef } from '@loch/data';
import { bandValue } from './level';
import type { Rng } from './rng';
import type { SpawnSpec } from './types';

/** Base monster count for a Chamber at a dungeon level (balance bands). */
export function rollBaseCount(data: GameData, rng: Rng, level: number): number {
  const [min, max] = bandValue(data.balance.baseMonsterCount, level);
  return rng.int(min, max);
}

/** A random ordinary monster for a dungeon level (weights from the data, minimum level respected). */
export function pickMonsterId(data: GameData, rng: Rng, level: number): string {
  const pool = Object.values(data.monsters).filter(
    (m) => m.minLevel <= level && m.chamberWeight > 0,
  );
  return rng.weighted(pool, (m) => m.chamberWeight).id;
}

/**
 * Monster composition of a tile. Rolled once when the tile is created and then fixed.
 * Boss rooms have no regular spawns (the boss is added by the combat simulation).
 */
export function generateSpawns(
  data: GameData,
  rng: Rng,
  roomType: RoomTypeDef,
  level: number,
): SpawnSpec[] {
  if (roomType.spawnMode === 'boss' || roomType.spawnMode === 'none') return [];
  const pickMonster = (): string => pickMonsterId(data, rng, level);

  if (roomType.spawnMode === 'single_elite') {
    return [{ monsterId: pickMonster(), elite: true }];
  }
  const base = rollBaseCount(data, rng, level);
  const count = roomType.spawnMode === 'base_minus_1' ? Math.max(1, base - 1) : base;
  const spawns: SpawnSpec[] = [];
  for (let i = 0; i < count; i++) spawns.push({ monsterId: pickMonster(), elite: false });
  return spawns;
}
