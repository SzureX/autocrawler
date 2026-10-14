import type { ArtifactInstance, Dir } from '../types';

export interface Cell {
  x: number;
  y: number;
}

export type DamageKind = 'attack' | 'splash' | 'reflect' | 'trap';
export type HealSource = 'lifesteal' | 'kill' | 'sanctuary' | 'fountain';
export type RaidEndReason = 'cleared' | 'died' | 'timeout';

/** Item revealed when a monster dies or a room is cleared (filled in by the loot system). */
export type LootItem =
  { kind: 'artifact'; artifact: ArtifactInstance } | { kind: 'upgrade'; upgradeId: string };

/** Environment as a damage source (traps). */
export const ENVIRONMENT = -1;

/**
 * Raid event log. Together with the board layout it is enough to replay a fight:
 * the view never computes combat itself.
 */
export type RaidEvent =
  | {
      type: 'RaidStart';
      tick: number;
      heroMaxHp: number;
      dungeonLevel: number;
      route: string[];
    }
  | {
      type: 'RoomEnter';
      tick: number;
      roomKey: string;
      roomTypeId: string;
      upgradeId: string | null;
      /** Cell where the hero appears (the door he came through). */
      entry: Cell;
      /** Pass-through room (already cleared); the hero crosses it to `exit` in `duration` ticks. */
      transit: boolean;
      exit: Cell | null;
      duration: number;
      /** Direction the hero walked to get here (null for the first room). */
      from: Dir | null;
    }
  | {
      type: 'Spawn';
      tick: number;
      unit: number;
      monsterId: string;
      elite: boolean;
      boss: boolean;
      summoned: boolean;
      x: number;
      y: number;
      hp: number;
      maxHp: number;
    }
  | { type: 'Move'; tick: number; unit: number; from: Cell; to: Cell; duration: number }
  | {
      type: 'Attack';
      tick: number;
      unit: number;
      target: number;
      hit: boolean;
      crit: boolean;
    }
  | {
      type: 'Damage';
      tick: number;
      unit: number;
      source: number;
      kind: DamageKind;
      amount: number;
      crit: boolean;
      hp: number;
      maxHp: number;
    }
  | {
      type: 'Heal';
      tick: number;
      unit: number;
      source: HealSource;
      amount: number;
      hp: number;
      maxHp: number;
    }
  | { type: 'Death'; tick: number; unit: number; killer: number }
  | { type: 'PhaseChange'; tick: number; unit: number; phase: number }
  | { type: 'RoomCleared'; tick: number; roomKey: string }
  | { type: 'LootDropped'; tick: number; unit: number | null; item: LootItem }
  | { type: 'RaidEnd'; tick: number; won: boolean; reason: RaidEndReason };

export interface RaidResult {
  won: boolean;
  reason: RaidEndReason;
  log: RaidEvent[];
  ticks: number;
  roomsCleared: number;
  roomsTotal: number;
  kills: number;
  heroHp: number;
  heroMaxHp: number;
  /** Where and to what the hero died (only when reason is "died"). */
  death: { roomKey: string; killerMonsterId: string | null } | null;
  /** Loot collected before the raid ended (artifacts and room upgrades). */
  lootArtifacts: ArtifactInstance[];
  lootUpgrades: string[];
}

export interface Unit {
  id: number;
  side: 'hero' | 'monster';
  monsterId: string;
  elite: boolean;
  isBoss: boolean;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  aspd: number;
  moveSpeed: number;
  critChance: number;
  critMult: number;
  accuracy: number;
  range: number;
  keepDistance: number;
  cooldownTicks: number;
  ticksPerCell: number;
  /** Ticks left until the next attack / the next step is allowed. */
  cooldown: number;
  moveTimer: number;
  targetId: number | null;
  retargetIn: number;
  /** False once the unit has been removed at the end of a tick. */
  alive: boolean;
  phase: number;
}
