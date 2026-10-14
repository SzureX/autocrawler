import type { GameData } from '@loch/data';
import type { RaidResult } from './combat/types';
import type { RunState } from './types';

function requirePrep(run: RunState, what: string): void {
  if (run.phase !== 'Prep') throw new Error(`Cannot ${what} in phase ${run.phase}`);
}

/**
 * Puts an upgrade from the storage into a room. One upgrade per room: a replaced upgrade
 * returns to the storage. Only legal in Prep.
 */
export function assignUpgrade(
  data: GameData,
  run: RunState,
  roomKey: string,
  upgradeId: string,
): RunState {
  requirePrep(run, 'assign an upgrade');
  if (!(upgradeId in data.roomUpgrades)) throw new Error(`Unknown upgrade: ${upgradeId}`);
  const room = run.dungeon.rooms[roomKey];
  if (!room) throw new Error(`No room at ${roomKey}`);
  const at = run.upgradeStorage.indexOf(upgradeId);
  if (at === -1) throw new Error(`Upgrade ${upgradeId} is not in the storage`);
  const storage = run.upgradeStorage.filter((_, i) => i !== at);
  if (room.upgradeId) storage.push(room.upgradeId);
  return {
    ...run,
    upgradeStorage: storage,
    dungeon: {
      ...run.dungeon,
      rooms: { ...run.dungeon.rooms, [roomKey]: { ...room, upgradeId } },
    },
  };
}

/** Takes the upgrade out of a room back into the storage. Only legal in Prep. */
export function removeUpgrade(run: RunState, roomKey: string): RunState {
  requirePrep(run, 'remove an upgrade');
  const room = run.dungeon.rooms[roomKey];
  if (!room) throw new Error(`No room at ${roomKey}`);
  if (!room.upgradeId) throw new Error(`Room ${roomKey} has no upgrade`);
  return {
    ...run,
    upgradeStorage: [...run.upgradeStorage, room.upgradeId],
    dungeon: {
      ...run.dungeon,
      rooms: { ...run.dungeon.rooms, [roomKey]: { ...room, upgradeId: null } },
    },
  };
}

/** Adds the loot of a finished raid to the backpack and the upgrade storage. */
export function applyRaidLoot(
  run: RunState,
  result: Pick<RaidResult, 'lootArtifacts' | 'lootUpgrades'>,
): RunState {
  return {
    ...run,
    backpack: [...run.backpack, ...result.lootArtifacts],
    upgradeStorage: [...run.upgradeStorage, ...result.lootUpgrades],
    // Artifact uids were minted from run.nextUid onwards, one per dropped artifact.
    nextUid: run.nextUid + result.lootArtifacts.length,
    stats: { ...run.stats, artifactsFound: run.stats.artifactsFound + result.lootArtifacts.length },
  };
}
