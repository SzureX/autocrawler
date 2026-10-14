import type { GameData, RoomTypeDef } from '@loch/data';
import { legalPlacements } from './dungeon';
import { DIRS, canonicalDoors } from './grid';
import { dungeonLevel } from './level';
import { setPhase } from './phases';
import { createRng, type Rng } from './rng';
import { generateSpawns } from './spawns';
import { mintUid } from './uid';
import type { Dir, RoomTile, RunState } from './types';

/** Door count 2/3/4 by balance weights, then a uniformly random set of that many doors. */
function rollDoors(data: GameData, rng: Rng): Dir[] {
  const w = data.balance.tileOffer.doorCountWeights;
  const weights: Record<number, number> = { 2: w['2'], 3: w['3'], 4: w['4'] };
  const count = rng.weighted([2, 3, 4], (n) => weights[n] ?? 0);
  const pool: Dir[] = [...DIRS];
  const chosen: Dir[] = [];
  for (let i = 0; i < count; i++) {
    const [dir] = pool.splice(rng.int(0, pool.length - 1), 1);
    if (dir) chosen.push(dir);
  }
  return canonicalDoors(chosen);
}

function bossRoomType(data: GameData): RoomTypeDef {
  const type = Object.values(data.roomTypes).find((r) => r.isBoss);
  if (!type) throw new Error('No boss room type');
  return type;
}

/**
 * Creates one tile. Guarantees at least one legal placement on the current dungeon:
 * the door mask is re-rolled up to `maxMaskRerolls` times, then a 4-door mask is used.
 */
function generateTile(
  data: GameData,
  run: RunState,
  roomType: RoomTypeDef,
  rng: Rng,
): { tile: RoomTile; run: RunState } {
  const minted = mintUid(run, 'tile');
  const spawnRng = createRng(run.seed).fork(`spawns:${minted.uid}`);
  const spawns = generateSpawns(data, spawnRng, roomType, dungeonLevel(run));

  let doors = rollDoors(data, rng);
  const maxRerolls = data.balance.tileOffer.maxMaskRerolls;
  for (let i = 0; i < maxRerolls; i++) {
    if (legalPlacements(data, run.dungeon, { doors, isBoss: false }).length > 0) break;
    doors = rollDoors(data, rng);
  }
  if (legalPlacements(data, run.dungeon, { doors, isBoss: false }).length === 0) {
    doors = [...DIRS];
  }
  const tile: RoomTile = { uid: minted.uid, roomTypeId: roomType.id, doors, spawns, isBoss: false };
  return { tile, run: minted.run };
}

/** Creates the first room's tile data (used by createRun): a Chamber with all four doors. */
export function createStartTile(data: GameData, seed: number): RoomTile {
  const chamber = data.roomTypes['chamber'];
  if (!chamber) throw new Error('Missing chamber room type');
  const uid = 'tile-0';
  const spawns = generateSpawns(data, createRng(seed).fork(`spawns:${uid}`), chamber, 1);
  return { uid, roomTypeId: chamber.id, doors: [...DIRS], spawns, isBoss: false };
}

/** Offers `tileOffer.count` tiles of different room types (when enough types exist). */
export function generateTileOffer(data: GameData, run: RunState): RunState {
  const rng = createRng(run.seed).fork('tiles', run.wavesWon);
  const regular = Object.values(data.roomTypes).filter((r) => !r.isBoss && r.offerWeight > 0);
  const offer: RoomTile[] = [];
  let cur = run;
  for (let i = 0; i < data.balance.tileOffer.count; i++) {
    const unused = regular.filter((r) => !offer.some((t) => t.roomTypeId === r.id));
    const pool = unused.length > 0 ? unused : regular;
    const type = rng.weighted(pool, (r) => r.offerWeight);
    const made = generateTile(data, cur, type, rng);
    offer.push(made.tile);
    cur = made.run;
  }
  return { ...cur, tileOffer: offer };
}

/** Boss tiles: one per boss in the data (the prototype ships one). All have 4 doors. */
export function generateBossOffer(data: GameData, run: RunState): RunState {
  const type = bossRoomType(data);
  let cur = run;
  const offer: RoomTile[] = [];
  for (const boss of Object.values(data.bosses)) {
    const minted = mintUid(cur, 'tile');
    cur = minted.run;
    offer.push({
      uid: minted.uid,
      roomTypeId: type.id,
      doors: [...DIRS],
      spawns: [],
      isBoss: true,
      bossId: boss.id,
    });
  }
  return { ...cur, tileOffer: offer };
}

/** Moves the chosen tile from the offer to the hand and enters Prep. */
export function chooseTile(run: RunState, tileUid: string): RunState {
  if (run.phase !== 'TileOffer' && run.phase !== 'BossOffer') {
    throw new Error(`Cannot choose a tile in phase ${run.phase}`);
  }
  const tile = run.tileOffer.find((t) => t.uid === tileUid);
  if (!tile) throw new Error(`Tile ${tileUid} is not in the offer`);
  return setPhase({ ...run, hand: [...run.hand, tile], tileOffer: [] }, 'Prep');
}
