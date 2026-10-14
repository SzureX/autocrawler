import type { GameData, RoomTypeDef } from '@loch/data';
import { computeHeroStats, activeEffects } from '../artifacts';
import { OPPOSITE, parseKey } from '../grid';
import { dungeonLevel, levelStatMultiplier } from '../level';
import { createRng, hashString } from '../rng';
import { computeRaidRoute } from '../route';
import type { Dir, RunState } from '../types';
import { cheb, doorCell } from './board';
import { emit, type RaidContext } from './context';
import { fightRoom } from './fight';
import { planRaid } from './plan';
import { ticksPerCellFor, makeHeroUnit, roomMods } from './units';
import type { Cell, RaidEndReason, RaidResult } from './types';

export interface SimulateOptions {
  /** Raid attempt index for the RNG stream (defaults to run.raidAttempts). */
  attempt?: number;
  /** Set to false to skip building the event log (balance runs). */
  recordLog?: boolean;
}

function directionBetween(from: string, to: string): Dir {
  const a = parseKey(from);
  const b = parseKey(to);
  if (b.y < a.y) return 'N';
  if (b.y > a.y) return 'S';
  return b.x > a.x ? 'E' : 'W';
}

/** Stable hash of an event log (determinism checks). */
export function hashRaidLog(log: readonly unknown[]): number {
  return hashString(JSON.stringify(log));
}

/**
 * Simulates one raid over the whole dungeon. Pure: the result depends only on the run state
 * (seed, dungeon, equipment) and the attempt index. The log is all a view needs to replay it.
 */
export function simulateRaid(
  data: GameData,
  run: RunState,
  options: SimulateOptions = {},
): RaidResult {
  const attempt = options.attempt ?? run.raidAttempts;
  const rng = createRng(run.seed).fork('combat', attempt);
  const route = computeRaidRoute(run.dungeon);
  const heroStats = computeHeroStats(data, run);
  const cls = data.classes[run.classId];
  if (!cls) throw new Error(`Unknown class: ${run.classId}`);
  const { combat } = data.balance;
  const level = dungeonLevel(run);
  const hero = makeHeroUnit(data, heroStats, doorCell(combat.board, 'S'));
  const effects = activeEffects(data, run.equipped);

  const ctx: RaidContext = {
    data,
    rng,
    rewardRng: createRng(run.seed).fork('rewards', attempt),
    log: options.recordLog === false ? null : [],
    tick: 0,
    tickLimit: combat.tickLimit,
    nextUnitId: 1,
    level,
    board: combat.board,
    hero,
    heroBase: { aspd: heroStats.aspd, accuracy: heroStats.accuracy },
    effects,
    counters: effects.map(() => 0),
    trait: cls.trait,
    levelMult: levelStatMultiplier(data.balance, level),
    kills: 0,
    lastHitBy: {},
    names: {},
    unitDrops: {},
    loot: { artifacts: [], upgrades: [], nextUid: run.nextUid },
  };
  const plans = planRaid(data, run, attempt, route, level);

  emit(ctx, {
    type: 'RaidStart',
    tick: 0,
    heroMaxHp: hero.maxHp,
    dungeonLevel: level,
    route: route.stops,
  });

  let roomsCleared = 0;
  let reason: RaidEndReason = 'cleared';
  let death: RaidResult['death'] = null;
  const tpc = ticksPerCellFor(combat.tickRate, heroStats.moveSpeed);

  const enterRoom = (
    key: string,
    entry: Cell,
    transit: boolean,
    exit: Cell | null,
    duration: number,
    from: Dir | null,
  ): void => {
    const room = run.dungeon.rooms[key];
    if (!room) throw new Error(`Route points at a missing room: ${key}`);
    emit(ctx, {
      type: 'RoomEnter',
      tick: ctx.tick,
      roomKey: key,
      roomTypeId: room.roomTypeId,
      upgradeId: room.upgradeId,
      entry,
      transit,
      exit,
      duration,
      from,
    });
  };

  routeLoop: for (let i = 0; i < route.stops.length; i++) {
    const stopKey = route.stops[i];
    const path = route.paths[i];
    if (stopKey === undefined || !path) break;
    let entry: Cell;
    let from: Dir | null = null;
    let travelled = 0;

    if (i === 0) {
      entry = doorCell(combat.board, 'S');
    } else {
      // Walk from where the last fight ended, through cleared rooms, to the next stop.
      let pos: Cell = { x: hero.x, y: hero.y };
      for (let s = 0; s + 1 < path.length; s++) {
        const a = path[s];
        const b = path[s + 1];
        if (a === undefined || b === undefined) break;
        const dir = directionBetween(a, b);
        const walk = (cheb(pos, doorCell(combat.board, dir)) + 1) * tpc;
        ctx.tick += walk;
        travelled = walk; // ticks spent reaching the room entered by this leg
        pos = doorCell(combat.board, OPPOSITE[dir]);
        from = dir;
        if (ctx.tick >= ctx.tickLimit) {
          reason = 'timeout';
          break routeLoop;
        }
        const isLast = s + 2 >= path.length;
        if (!isLast) {
          const next = path[s + 2];
          const nextDir = next === undefined ? dir : directionBetween(b, next);
          enterRoom(b, pos, true, doorCell(combat.board, nextDir), walk, dir);
        }
      }
      entry = pos;
    }

    const room = run.dungeon.rooms[stopKey];
    if (!room) throw new Error(`Missing room ${stopKey}`);
    const type: RoomTypeDef | undefined = data.roomTypes[room.roomTypeId];
    if (!type) throw new Error(`Unknown room type ${room.roomTypeId}`);
    enterRoom(stopKey, entry, false, null, travelled, from);

    const mods = roomMods(room.upgradeId ? data.roomUpgrades[room.upgradeId] : undefined);
    const plan = plans[stopKey];
    const outcome = fightRoom(
      ctx,
      room,
      type,
      mods,
      entry,
      plan?.specs ?? room.spawns,
      plan?.drops ?? [],
    );
    if (outcome === 'cleared') {
      roomsCleared++;
      continue;
    }
    reason = outcome;
    if (outcome === 'died') {
      const killer = ctx.lastHitBy[0];
      death = {
        roomKey: stopKey,
        killerMonsterId: killer !== undefined ? (ctx.names[killer] ?? null) : null,
      };
    }
    break;
  }

  const won = reason === 'cleared';
  emit(ctx, { type: 'RaidEnd', tick: ctx.tick, won, reason });
  return {
    won,
    reason,
    log: ctx.log ?? [],
    ticks: ctx.tick,
    roomsCleared,
    roomsTotal: route.stops.length,
    kills: ctx.kills,
    heroHp: hero.hp,
    heroMaxHp: hero.maxHp,
    death,
    lootArtifacts: ctx.loot.artifacts,
    lootUpgrades: ctx.loot.upgrades,
  };
}
