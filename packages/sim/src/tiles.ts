import type { GameData, RoomTypeDef } from '@loch/data';
import { FORWARD_DIRS, feasibleExits, nextSlot, takenCells, tilesLeft } from './chain';
import { legalPlacements, placeTile } from './dungeon';
import { canonicalDoors } from './grid';
import { dungeonLevel } from './level';
import { setPhase } from './phases';
import { createRng, type Rng } from './rng';
import { pickLayoutId } from './layouts';
import { generateSpawns } from './spawns';
import { mintUid } from './uid';
import type { Dir, RoomTile, RunState } from './types';

function bossRoomType(data: GameData): RoomTypeDef {
  const type = Object.values(data.roomTypes).find((r) => r.isBoss);
  if (!type) throw new Error('No boss room type');
  return type;
}

/**
 * Creates one tile with exactly two doors: the entrance (facing the chain's open exit) and an
 * exit that is never west and always leaves the chain completable. Because the chain's next slot
 * is fixed, the tile always has exactly one legal placement.
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

  const slot = nextSlot(data, run.dungeon);
  if (!slot) throw new Error('The chain has no free slot for the next tile');
  const exits = feasibleExits(
    data,
    slot.cell,
    slot.entrance,
    tilesLeft(data, run.dungeon),
    takenCells(run.dungeon),
  );
  // Unreachable while the chain is feasible; fall back to any forward exit rather than crash.
  const options = exits.length > 0 ? exits : FORWARD_DIRS.filter((d) => d !== slot.entrance);
  const exit = options[rng.int(0, options.length - 1)] ?? 'E';
  const doors = canonicalDoors([slot.entrance, exit]);
  const layoutId = pickLayoutId(
    data,
    createRng(run.seed).fork(`layout:${minted.uid}`),
    roomType.id,
    doors,
  );
  const tile: RoomTile = {
    uid: minted.uid,
    roomTypeId: roomType.id,
    doors,
    spawns,
    isBoss: false,
    ...(layoutId ? { layoutId } : {}),
  };
  return { tile, run: minted.run };
}

/** Creates the first room's tile data (used by createRun): a Chamber with a single east door. */
export function createStartTile(data: GameData, seed: number): RoomTile {
  const chamber = data.roomTypes['chamber'];
  if (!chamber) throw new Error('Missing chamber room type');
  const uid = 'tile-0';
  const spawns = generateSpawns(data, createRng(seed).fork(`spawns:${uid}`), chamber, 1);
  const layoutId = pickLayoutId(data, createRng(seed).fork(`layout:${uid}`), chamber.id, ['E']);
  return {
    uid,
    roomTypeId: chamber.id,
    doors: ['E'],
    spawns,
    isBoss: false,
    ...(layoutId ? { layoutId } : {}),
  };
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

/** Boss tiles: one per boss in the data (the prototype ships one). Entrance only, no exit. */
export function generateBossOffer(data: GameData, run: RunState): RunState {
  const type = bossRoomType(data);
  const slot = nextSlot(data, run.dungeon);
  const doors: Dir[] = slot ? [slot.entrance] : ['W'];
  let cur = run;
  const offer: RoomTile[] = [];
  for (const boss of Object.values(data.bosses)) {
    const minted = mintUid(cur, 'tile');
    cur = minted.run;
    const layoutId = pickLayoutId(
      data,
      createRng(run.seed).fork(`layout:${minted.uid}`),
      type.id,
      doors,
    );
    offer.push({
      uid: minted.uid,
      roomTypeId: type.id,
      doors: [...doors],
      spawns: [],
      isBoss: true,
      bossId: boss.id,
      ...(layoutId ? { layoutId } : {}),
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

/**
 * Takes a tile from the offer and builds it at once when it has exactly one legal position (every
 * tile of the one-way chain, the boss included). A tile with several positions (a boss in a closed
 * dungeon) or none stays in the hand for the player to place or discard.
 */
export function chooseAndPlaceTile(data: GameData, run: RunState, tileUid: string): RunState {
  const chosen = chooseTile(run, tileUid);
  const tile = chosen.hand.find((t) => t.uid === tileUid);
  if (!tile) return chosen;
  const spots = legalPlacements(data, chosen.dungeon, tile);
  const only = spots.length === 1 ? spots[0] : undefined;
  return only ? placeTile(data, chosen, tile.uid, only) : chosen;
}
