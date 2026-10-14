import { loadGameData, type GameData } from '@loch/data';
import { legalPlacements, placeTile } from './dungeon';
import type { RaidEvent } from './combat/types';
import { gridKey } from './grid';
import { createRng } from './rng';
import { createRun } from './run';
import { chooseTile, generateTileOffer } from './tiles';
import type {
  ArtifactInstance,
  Dir,
  DungeonState,
  RoomInstance,
  RunState,
  SpawnSpec,
} from './types';

/** Shared game data for tests. */
export const testData: GameData = loadGameData();

/** Builds a dungeon from [x, y, doors, isBoss?] rows; the first row is the start room. */
export function makeDungeon(rows: [number, number, Dir[], boolean?][]): DungeonState {
  const rooms: Record<string, RoomInstance> = {};
  rows.forEach(([x, y, doors, isBoss], i) => {
    rooms[gridKey(x, y)] = {
      uid: `t-${i}`,
      roomTypeId: isBoss ? 'boss_room' : 'chamber',
      doors,
      spawns: [],
      isBoss: isBoss ?? false,
      pos: { x, y },
      order: i,
      upgradeId: null,
    };
  });
  const first = rows[0];
  if (!first) throw new Error('empty dungeon');
  return { rooms, startKey: gridKey(first[0], first[1]) };
}

/**
 * Plays the build loop at random (choose a random offered tile, place it at a random legal
 * position, advance a wave) and returns every intermediate state that holds a fresh offer.
 */
export function randomBuild(seed: number, waves: number): RunState[] {
  const rng = createRng(seed).fork('test-build');
  let run = createRun(testData, seed, 'warrior');
  const offers: RunState[] = [run];
  for (let w = 0; w < waves; w++) {
    const pick = rng.pick(run.tileOffer);
    run = chooseTile(run, pick.uid);
    const spots = legalPlacements(testData, run.dungeon, pick);
    if (spots.length === 0) break;
    run = placeTile(testData, run, pick.uid, rng.pick(spots));
    run = generateTileOffer(testData, { ...run, wavesWon: run.wavesWon + 1, phase: 'TileOffer' });
    offers.push(run);
  }
  return offers;
}

/** Deep copy of the shared game data, optionally tweaked (for mechanic tests). */
export function cloneData(mutate?: (d: GameData) => void): GameData {
  const copy = JSON.parse(JSON.stringify(testData)) as GameData;
  mutate?.(copy);
  return copy;
}

export interface RoomSpec {
  x: number;
  y: number;
  doors?: Dir[];
  roomTypeId?: string;
  spawns?: SpawnSpec[];
  upgradeId?: string | null;
  bossId?: string;
}

export interface ScenarioOptions {
  data?: GameData;
  classId?: string;
  seed?: number;
  wavesWon?: number;
  /** First room is the start room. Defaults to one chamber with a single rat. */
  rooms?: RoomSpec[];
  equipment?: ({ id: string; level?: 1 | 2 | 3 } | string)[];
}

/** A Prep-phase run with a hand-made dungeon and equipment. */
export function scenario(opts: ScenarioOptions = {}): { data: GameData; run: RunState } {
  const data = opts.data ?? testData;
  const base = createRun(data, opts.seed ?? 1, opts.classId ?? 'warrior');
  const specs = opts.rooms ?? [{ x: 4, y: 4, spawns: [{ monsterId: 'rat', elite: false }] }];
  const rooms: Record<string, RoomInstance> = {};
  specs.forEach((s, i) => {
    rooms[gridKey(s.x, s.y)] = {
      uid: `s-${i}`,
      roomTypeId: s.bossId ? 'boss_room' : (s.roomTypeId ?? 'chamber'),
      doors: s.doors ?? ['N', 'E', 'S', 'W'],
      spawns: s.spawns ?? [],
      isBoss: s.bossId !== undefined,
      ...(s.bossId !== undefined ? { bossId: s.bossId } : {}),
      pos: { x: s.x, y: s.y },
      order: i,
      upgradeId: s.upgradeId ?? null,
    };
  });
  const first = specs[0];
  if (!first) throw new Error('no rooms');
  const equipped: (ArtifactInstance | null)[] = Array.from({ length: 9 }, () => null);
  (opts.equipment ?? []).forEach((e, i) => {
    const spec =
      typeof e === 'string' ? { id: e, level: 1 as const } : { id: e.id, level: e.level ?? 1 };
    equipped[i] = { uid: `e-${i}`, artifactId: spec.id, level: spec.level };
  });
  return {
    data,
    run: {
      ...base,
      phase: 'Prep',
      wavesWon: opts.wavesWon ?? 0,
      tileOffer: [],
      dungeon: { rooms, startKey: gridKey(first.x, first.y) },
      equipped,
    },
  };
}

export interface ReplayState {
  pos: Record<number, { x: number; y: number }>;
  hp: Record<number, number>;
  maxHp: Record<number, number>;
  monsterId: Record<number, string>;
}

/** Replays a raid log; `visit` sees every event together with the state just BEFORE it. */
export function replay(
  log: readonly RaidEvent[],
  visit: (event: RaidEvent, state: ReplayState) => void,
): ReplayState {
  const state: ReplayState = { pos: {}, hp: {}, maxHp: {}, monsterId: {} };
  for (const e of log) {
    visit(e, state);
    switch (e.type) {
      case 'RaidStart':
        state.hp[0] = e.heroMaxHp;
        state.maxHp[0] = e.heroMaxHp;
        break;
      case 'RoomEnter':
        state.pos[0] = { ...e.entry };
        break;
      case 'Spawn':
        state.pos[e.unit] = { x: e.x, y: e.y };
        state.hp[e.unit] = e.hp;
        state.maxHp[e.unit] = e.maxHp;
        state.monsterId[e.unit] = e.monsterId;
        break;
      case 'Move':
        state.pos[e.unit] = { ...e.to };
        break;
      case 'Damage':
      case 'Heal':
        state.hp[e.unit] = e.hp;
        break;
      default:
        break;
    }
  }
  return state;
}
