import { z } from 'zod';
import { dirSchema } from '@loch/data';
import { EQUIP_SLOTS, type RunState } from './types';

const artifactInstanceSchema = z.object({
  uid: z.string(),
  artifactId: z.string(),
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
});

const roomTileShape = {
  uid: z.string(),
  roomTypeId: z.string(),
  doors: z.array(dirSchema),
  spawns: z.array(z.object({ monsterId: z.string(), elite: z.boolean() })),
  isBoss: z.boolean(),
  bossId: z.string().optional(),
  layoutId: z.string().optional(),
};
const roomTileSchema = z.object(roomTileShape);
const roomInstanceSchema = z.object({
  ...roomTileShape,
  pos: z.object({ x: z.number().int(), y: z.number().int() }),
  order: z.number().int(),
  upgradeId: z.string().nullable(),
});

const raidSummarySchema = z.object({
  won: z.boolean(),
  reason: z.string(),
  ticks: z.number().int(),
  roomsCleared: z.number().int(),
  lootArtifacts: z.array(artifactInstanceSchema),
  lootUpgrades: z.array(z.string()),
  livesLost: z.number().int(),
  xpGained: z.number().int().min(0),
  killer: z.string().nullable().optional(),
});

export const runStateSchema = z.object({
  saveVersion: z.number().int(),
  seed: z.number().int(),
  classId: z.string(),
  phase: z.enum([
    'ClassSelect',
    'TileOffer',
    'BossOffer',
    'Prep',
    'Action',
    'Resolve',
    'Victory',
    'GameOver',
  ]),
  lives: z.number().int().min(0),
  wavesWon: z.number().int().min(0),
  raidAttempts: z.number().int().min(0),
  dungeon: z.object({ rooms: z.record(z.string(), roomInstanceSchema), startKey: z.string() }),
  hand: z.array(roomTileSchema),
  tileOffer: z.array(roomTileSchema),
  backpack: z.array(artifactInstanceSchema),
  equipped: z.array(artifactInstanceSchema.nullable()).length(EQUIP_SLOTS),
  upgradeStorage: z.array(z.string()),
  lastRaid: raidSummarySchema.nullable(),
  stats: z.object({
    raids: z.number().int(),
    wins: z.number().int(),
    losses: z.number().int(),
    merges: z.number().int(),
    artifactsFound: z.number().int(),
  }),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  nextUid: z.number().int().min(0),
});

export const CURRENT_SAVE_VERSION = 4;

export class RunParseError extends Error {}

/** Migration stub: upgrades an older save object to the current shape. */
export function migrateRun(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw;
  const version = (raw as { saveVersion?: unknown }).saveVersion;
  if (version === CURRENT_SAVE_VERSION) return raw;
  throw new RunParseError(`Unsupported saveVersion: ${String(version)}`);
}

export function serializeRun(run: RunState): string {
  return JSON.stringify(run);
}

export function deserializeRun(text: string): RunState {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new RunParseError('Save is not valid JSON');
  }
  const res = runStateSchema.safeParse(migrateRun(raw));
  if (!res.success) throw new RunParseError(`Invalid save: ${res.error.message}`);
  return res.data;
}
