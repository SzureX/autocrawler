import { z } from 'zod';

export const dirSchema = z.enum(['N', 'E', 'S', 'W']);
export type Dir = z.infer<typeof dirSchema>;

export const raritySchema = z.enum(['common', 'rare', 'epic']);
export type Rarity = z.infer<typeof raritySchema>;
export const RARITIES = ['common', 'rare', 'epic'] as const;

const id = z.string().regex(/^[a-z][a-z0-9_]*$/);

export const statBlockSchema = z.object({
  maxHp: z.number().positive(),
  atk: z.number().positive(),
  aspd: z.number().positive(),
  def: z.number().min(0),
  moveSpeed: z.number().positive(),
  critChance: z.number().min(0).max(1),
  critMult: z.number().min(1),
  accuracy: z.number().positive(),
  range: z.number().int().min(1),
});
export type StatBlock = z.infer<typeof statBlockSchema>;
export type StatKey = keyof StatBlock;

export const statModifierSchema = z.object({
  stat: statBlockSchema.keyof(),
  kind: z.enum(['flat', 'percentAdd', 'percentMult']),
  value: z.number(),
});
export type StatModifier = z.infer<typeof statModifierSchema>;

export const classSchema = z.object({
  id,
  nameKey: z.string(),
  descKey: z.string(),
  traitKey: z.string(),
  stats: statBlockSchema,
  trait: z.object({
    kind: z.enum(['none', 'healOnKill', 'aoe']),
    value: z.number().min(0),
    radius: z.number().int().min(0).default(0),
  }),
});
export type ClassDef = z.infer<typeof classSchema>;

export const effectTypeSchema = z.enum([
  'everyNthAttack',
  'lifesteal',
  'reflect',
  'executeBonus',
  'firstStrike',
]);
export type EffectType = z.infer<typeof effectTypeSchema>;

export const artifactSchema = z.object({
  id,
  nameKey: z.string(),
  descKey: z.string(),
  rarity: raritySchema,
  tag: z.enum(['tank', 'blade', 'swift', 'vampire']),
  dropWeight: z.number().positive(),
  modifiers: z.array(statModifierSchema),
  effects: z.array(
    z.object({
      type: effectTypeSchema,
      value: z.number().positive(),
      n: z.number().int().positive().optional(),
      threshold: z.number().positive().optional(),
    }),
  ),
});
export type ArtifactDef = z.infer<typeof artifactSchema>;

export const monsterSchema = z.object({
  id,
  nameKey: z.string(),
  icon: z.string(),
  stats: statBlockSchema,
  ai: z.enum(['melee', 'ranged']),
  keepDistance: z.number().int().min(0).default(0),
  chamberWeight: z.number().min(0),
  minLevel: z.number().int().min(1),
});
export type MonsterDef = z.infer<typeof monsterSchema>;

export const bossSchema = z.object({
  id,
  nameKey: z.string(),
  icon: z.string(),
  stats: statBlockSchema,
  phase: z.object({
    hpThreshold: z.number().gt(0).lt(1),
    summonMonsterId: z.string(),
    summonCount: z.number().int().positive(),
    aspdMult: z.number().positive(),
  }),
});
export type BossDef = z.infer<typeof bossSchema>;

/** Effect applied by a room type when the hero enters or clears the room. */
export const roomEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('damagePctMaxHp'), value: z.number().positive() }),
  z.object({ kind: z.literal('healPctMaxHp'), value: z.number().positive() }),
  z.object({ kind: z.literal('grantRoomUpgrade'), count: z.number().int().positive() }),
  /** The hero walks to the room's chest and takes `count` random artifacts. */
  z.object({ kind: z.literal('chestLoot'), count: z.number().int().positive() }),
  z.object({
    kind: z.literal('bonusArtifactChance'),
    chance: z.number().min(0).max(1),
    count: z.number().int().positive(),
  }),
]);
export type RoomEffect = z.infer<typeof roomEffectSchema>;

export const roomTypeSchema = z.object({
  id,
  nameKey: z.string(),
  descKey: z.string(),
  icon: z.string(),
  offerWeight: z.number().min(0),
  spawnMode: z.enum(['none', 'base', 'base_minus_1', 'single_elite', 'boss']),
  dropWeightMult: z.number().positive(),
  onEnter: z.array(roomEffectSchema),
  onClear: z.array(roomEffectSchema),
  /**
   * Rolled again at the start of every raid: with `chestChance` the room holds a chest with
   * `chestItems` artifacts, otherwise it is a fight against `monsters` ordinary monsters.
   */
  outcome: z
    .object({
      chestChance: z.number().min(0).max(1),
      chestItems: z.number().int().positive(),
      monsters: z.number().int().positive(),
    })
    .optional(),
  isBoss: z.boolean(),
});
export type RoomTypeDef = z.infer<typeof roomTypeSchema>;

export const upgradeEffectSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('extraMonster'), dropWeightBonus: z.number().min(0) }),
  z.object({ kind: z.literal('healOnClearPct'), value: z.number().positive() }),
  z.object({ kind: z.literal('artifactOnClear'), minRarity: raritySchema }),
  z.object({ kind: z.literal('accuracyMult'), value: z.number().positive() }),
  z.object({ kind: z.literal('heroAspdMult'), value: z.number().positive() }),
  z.object({ kind: z.literal('monsterMoveSpeedMult'), value: z.number().positive() }),
  z.object({ kind: z.literal('monsterHpMult'), value: z.number().positive() }),
  z.object({ kind: z.literal('guaranteedFirstCrit') }),
]);
export type UpgradeEffect = z.infer<typeof upgradeEffectSchema>;

export const roomUpgradeSchema = z.object({
  id,
  nameKey: z.string(),
  descKey: z.string(),
  icon: z.string(),
  effects: z.array(upgradeEffectSchema).min(1),
});
export type RoomUpgradeDef = z.infer<typeof roomUpgradeSchema>;

const intRange = z.tuple([z.number().int().min(0), z.number().int().min(0)]);

const levelBand = <T extends z.ZodType>(value: T) =>
  z.object({ fromLevel: z.number().int().min(1), toLevel: z.number().int().min(1), value });

export const balanceSchema = z.object({
  startLives: z.number().int().positive(),
  wavesToBoss: z.number().int().positive(),
  grid: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
  maxRooms: z.number().int().positive(),
  tileOffer: z.object({
    count: z.number().int().positive(),
    doorCountWeights: z.object({ '2': z.number(), '3': z.number(), '4': z.number() }),
    maxMaskRerolls: z.number().int().min(0),
  }),
  levelStatMultipliers: z.array(z.number().positive()).min(1),
  levelMult: z.tuple([z.number(), z.number(), z.number()]),
  baseMonsterCount: z.array(levelBand(intRange)),
  rarityWeights: z.array(
    levelBand(z.object({ common: z.number(), rare: z.number(), epic: z.number() })),
  ),
  artifactDrops: z.array(levelBand(intRange)),
  upgradeDrops: z.array(levelBand(intRange)),
  elite: z.object({ hpMult: z.number(), atkMult: z.number(), dropWeightMult: z.number() }),
  monsterDropWeight: z.number().positive(),
  combat: z.object({
    tickRate: z.number().int().positive(),
    tickLimit: z.number().int().positive(),
    board: z.object({ width: z.number().int().positive(), height: z.number().int().positive() }),
    retargetTicks: z.number().int().positive(),
    /** Chest cell (the front faces south, the hero stands one cell below) and opening time. */
    chest: z.object({
      x: z.number().int().min(0),
      y: z.number().int().min(0),
      openTicks: z.number().int().positive(),
    }),
  }),
  threat: z.object({ mediumFrom: z.number().positive(), highFrom: z.number().positive() }),
  effects: z.object({
    healOnKillPct: z.number(),
    aoeMult: z.number(),
  }),
});
export type Balance = z.infer<typeof balanceSchema>;

/** Floor piece of a room layout: `x,y` is the top-left cell, `rot` quarter turns. */
export const floorPieceSchema = z.object({
  id: z.string().min(1),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  rot: z.number().int().min(0).max(3),
});
export type FloorPieceDef = z.infer<typeof floorPieceSchema>;

/** Prop of a room layout: world position in cells on a half-cell grid, `rot` in eighth turns. */
export const propPieceSchema = z.object({
  id: z.string().min(1),
  x: z.number(),
  z: z.number(),
  rot: z.number().int().min(0).max(7),
  y: z.number().optional(),
});
export type PropPieceDef = z.infer<typeof propPieceSchema>;

/**
 * A room layout made in the room builder: floors and props for one room type. `doors` null means
 * "normal" (fits any room of the type); otherwise the layout is only used by rooms whose doors are
 * exactly that set. `blocked` lists the board cells the props occupy (units cannot enter them).
 */
export const roomLayoutSchema = z.object({
  id,
  name: z.string().min(1),
  roomTypeId: z.string().min(1),
  doors: z.array(dirSchema).nullable(),
  floors: z.array(floorPieceSchema),
  props: z.array(propPieceSchema),
  blocked: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])),
});
export type RoomLayoutDef = z.infer<typeof roomLayoutSchema>;

export const metaSchema = z.object({ gameName: z.string(), saveVersion: z.number().int() });
export type Meta = z.infer<typeof metaSchema>;

export interface GameData {
  meta: Meta;
  balance: Balance;
  classes: Record<string, ClassDef>;
  artifacts: Record<string, ArtifactDef>;
  roomTypes: Record<string, RoomTypeDef>;
  monsters: Record<string, MonsterDef>;
  bosses: Record<string, BossDef>;
  roomUpgrades: Record<string, RoomUpgradeDef>;
  roomLayouts: Record<string, RoomLayoutDef>;
}
