import type { Dir, StatBlock, StatModifier } from '@loch/data';

export type { Dir, StatBlock, StatModifier };
export type { Rarity } from '@loch/data';

export type RunPhase =
  | 'ClassSelect'
  | 'TileOffer'
  | 'BossOffer'
  | 'Prep'
  | 'Action'
  | 'Resolve'
  | 'Victory'
  | 'GameOver';

export const RUN_PHASES: readonly RunPhase[] = [
  'ClassSelect',
  'TileOffer',
  'BossOffer',
  'Prep',
  'Action',
  'Resolve',
  'Victory',
  'GameOver',
];

export const EQUIP_SLOTS = 9;

export interface ArtifactInstance {
  uid: string;
  artifactId: string;
  level: 1 | 2 | 3;
}

export interface SpawnSpec {
  monsterId: string;
  elite: boolean;
}

export interface RoomTile {
  uid: string;
  roomTypeId: string;
  doors: Dir[];
  spawns: SpawnSpec[];
  isBoss: boolean;
  bossId?: string;
  /** Room layout made in the room builder, fixed when the tile is created (none = default look). */
  layoutId?: string;
}

export interface Pos {
  x: number;
  y: number;
}

export interface RoomInstance extends RoomTile {
  pos: Pos;
  order: number;
  upgradeId: string | null;
}

export interface DungeonState {
  /** Key is "x,y". */
  rooms: Record<string, RoomInstance>;
  startKey: string;
}

export interface RunStats {
  raids: number;
  wins: number;
  losses: number;
  merges: number;
  artifactsFound: number;
}

/** Result of a finished raid, shown on the Resolve screen. */
export interface RaidSummary {
  won: boolean;
  reason: string;
  ticks: number;
  roomsCleared: number;
  lootArtifacts: ArtifactInstance[];
  lootUpgrades: string[];
  livesLost: number;
  /** Monster id that killed the hero (null when the hero survived or died to the environment). */
  killer?: string | null;
}

export interface RunState {
  saveVersion: number;
  seed: number;
  classId: string;
  phase: RunPhase;
  lives: number;
  wavesWon: number;
  raidAttempts: number;
  dungeon: DungeonState;
  hand: RoomTile[];
  tileOffer: RoomTile[];
  backpack: ArtifactInstance[];
  equipped: (ArtifactInstance | null)[];
  upgradeStorage: string[];
  lastRaid: RaidSummary | null;
  stats: RunStats;
  /** Counter used to mint unique ids (tiles, artifacts). Keeps ids deterministic. */
  nextUid: number;
}
