import type { ClassDef, GameData } from '@loch/data';
import type { ActiveEffect } from '../artifacts';
import type { DropSpec } from '../loot';
import type { Rng } from '../rng';
import type { ArtifactInstance } from '../types';
import type { BoardSize } from './board';
import type { RaidEvent, Unit } from './types';

/** State shared by the whole raid. */
export interface RaidContext {
  data: GameData;
  /** Combat rolls (hit, crit, spawn cells). */
  rng: Rng;
  /** Room clear rewards (separate stream so combat rolls stay independent of loot). */
  rewardRng: Rng;
  log: RaidEvent[] | null;
  tick: number;
  tickLimit: number;
  nextUnitId: number;
  level: number;
  board: BoardSize;
  hero: Unit;
  heroBase: { aspd: number; accuracy: number };
  effects: ActiveEffect[];
  /** Attack counters, parallel to `effects` (used by "every Nth attack"). */
  counters: number[];
  trait: ClassDef['trait'];
  levelMult: number;
  kills: number;
  lastHitBy: Record<number, number>;
  /** Monster id by unit id (for death reports). */
  names: Record<number, string>;
  /** Drops carried by living monsters, by unit id. */
  unitDrops: Record<number, DropSpec[]>;
  /** Cells of the current room that props block (units cannot enter them). */
  blocked: Record<string, boolean>;
  /** Loot collected so far; artifact uids continue the run's counter. */
  loot: { artifacts: ArtifactInstance[]; upgrades: string[]; nextUid: number };
}

export function emit(ctx: RaidContext, event: RaidEvent): void {
  if (ctx.log) ctx.log.push(event);
}
