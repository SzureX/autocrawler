import type { GameData } from '@loch/data';
import { planDrops, type DropSpec } from '../loot';
import { createRng } from '../rng';
import type { RaidRoute } from '../route';
import { pickMonsterId } from '../spawns';
import type { RunState, SpawnSpec } from '../types';
import { roomMods } from './units';

export interface RoomPlan {
  /** Final monsters of the room (Blood Altar adds copies). */
  specs: SpawnSpec[];
  /** Drops carried by each monster, parallel to `specs`. */
  drops: (DropSpec[] | undefined)[];
  /** Artifacts waiting in the room's chest this raid (0 = no chest). */
  chestItems: number;
}

/**
 * Everything random that must be known before the first tick: the final monster list of every
 * room and the pre-rolled drops assigned to those monsters (CLAUDE.md 6.6).
 */
export function planRaid(
  data: GameData,
  run: RunState,
  attempt: number,
  route: RaidRoute,
  level: number,
): Record<string, RoomPlan> {
  const extraRng = createRng(run.seed).fork('extra', attempt);
  const outcomeRng = createRng(run.seed).fork('outcome', attempt);
  const plans: Record<string, RoomPlan> = {};
  const weights: number[] = [];
  const owners: { key: string; index: number }[] = [];

  for (const key of route.stops) {
    const room = run.dungeon.rooms[key];
    if (!room) continue;
    const type = data.roomTypes[room.roomTypeId];
    const mods = roomMods(room.upgradeId ? data.roomUpgrades[room.upgradeId] : undefined);
    let specs = room.spawns.map((s) => ({ ...s }));
    let chestItems = 0;
    for (const e of type?.onEnter ?? []) if (e.kind === 'chestLoot') chestItems += e.count;
    // Rooms like the Trap are decided anew in every raid: a chest or a fight.
    if (type?.outcome) {
      if (outcomeRng.chance(type.outcome.chestChance)) {
        chestItems = type.outcome.chestItems;
      } else {
        specs = [];
        for (let i = 0; i < type.outcome.monsters; i++) {
          specs.push({ monsterId: pickMonsterId(data, outcomeRng, level), elite: false });
        }
      }
    }
    for (let i = 0; i < mods.extraMonsters && specs.length > 0; i++) {
      const copy = specs[extraRng.int(0, specs.length - 1)];
      if (copy) specs.push({ ...copy });
    }
    plans[key] = { specs, drops: specs.map(() => undefined), chestItems };
    specs.forEach((spec, index) => {
      const w =
        data.balance.monsterDropWeight *
        (spec.elite ? data.balance.elite.dropWeightMult : 1) *
        (type?.dropWeightMult ?? 1) *
        mods.dropWeightMult;
      weights.push(w);
      owners.push({ key, index });
    });
  }

  const dropPlan = planDrops(data, createRng(run.seed).fork('drops', attempt), level, weights);
  dropPlan.forEach((drops, i) => {
    const owner = owners[i];
    const plan = owner ? plans[owner.key] : undefined;
    if (owner && plan && drops.length > 0) plan.drops[owner.index] = drops;
  });
  return plans;
}
