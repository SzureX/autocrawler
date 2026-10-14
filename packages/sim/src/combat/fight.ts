import type { RoomTypeDef } from '@loch/data';
import type { DropSpec } from '../loot';
import type { RoomInstance, SpawnSpec } from '../types';
import { cheb, findRetreat, findStep, inBoard } from './board';
import { emit, type RaidContext } from './context';
import { collectDrops, grantClearRewards } from './rewards';
import {
  cooldownTicksFor,
  makeBossUnit,
  makeMonsterUnit,
  type RoomMods,
  type ScalingContext,
} from './units';
import { ENVIRONMENT, type Cell, type DamageKind, type HealSource, type Unit } from './types';

const round2 = (v: number): number => Math.round(v * 100) / 100;

interface RoomState {
  room: RoomInstance;
  type: RoomTypeDef;
  mods: RoomMods;
  monsters: Unit[];
  firstAttackDone: boolean;
}

export type RoomOutcome = 'cleared' | 'died' | 'timeout';

function occupied(ctx: RaidContext, rs: RoomState, x: number, y: number): boolean {
  if (ctx.hero.alive && ctx.hero.x === x && ctx.hero.y === y) return true;
  for (const m of rs.monsters) if (m.alive && m.x === x && m.y === y) return true;
  return false;
}

function heal(ctx: RaidContext, unit: Unit, amount: number, source: HealSource): number {
  const effective = round2(Math.min(amount, unit.maxHp - unit.hp));
  if (effective <= 0) return 0;
  unit.hp = round2(unit.hp + effective);
  emit(ctx, {
    type: 'Heal',
    tick: ctx.tick,
    unit: unit.id,
    source,
    amount: effective,
    hp: unit.hp,
    maxHp: unit.maxHp,
  });
  return effective;
}

/** Applies damage; returns the damage that actually reduced HP (no overkill). */
function dealDamage(
  ctx: RaidContext,
  target: Unit,
  amount: number,
  source: number,
  kind: DamageKind,
  crit: boolean,
): number {
  const effective = Math.min(amount, target.hp);
  target.hp = round2(target.hp - effective);
  ctx.lastHitBy[target.id] = source;
  emit(ctx, {
    type: 'Damage',
    tick: ctx.tick,
    unit: target.id,
    source,
    kind,
    amount,
    crit,
    hp: target.hp,
    maxHp: target.maxHp,
  });
  return effective;
}

const defReduction = (atk: number, def: number): number => Math.max(1, (atk * 100) / (100 + def));

function spawnMonsters(
  ctx: RaidContext,
  rs: RoomState,
  scaling: ScalingContext,
  specs: readonly SpawnSpec[],
  drops: readonly (DropSpec[] | undefined)[],
): void {
  const { data, rng, board } = ctx;
  const hero = ctx.hero;
  const candidates: Cell[] = [];
  for (let min = 3; candidates.length < specs.length + 1 && min >= 0; min--) {
    candidates.length = 0;
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        if (cheb({ x, y }, hero) >= min) candidates.push({ x, y });
      }
    }
  }
  const take = (): Cell => {
    const i = rng.int(0, candidates.length - 1);
    const [cell] = candidates.splice(i, 1);
    if (!cell) throw new Error('No free spawn cell');
    return cell;
  };
  const add = (unit: Unit, summoned: boolean): void => {
    rs.monsters.push(unit);
    ctx.names[unit.id] = unit.monsterId;
    emit(ctx, {
      type: 'Spawn',
      tick: ctx.tick,
      unit: unit.id,
      monsterId: unit.monsterId,
      elite: unit.elite,
      boss: unit.isBoss,
      summoned,
      x: unit.x,
      y: unit.y,
      hp: unit.hp,
      maxHp: unit.maxHp,
    });
  };
  specs.forEach((spec, i) => {
    const def = data.monsters[spec.monsterId];
    if (!def) throw new Error(`Unknown monster: ${spec.monsterId}`);
    const unit = makeMonsterUnit(scaling, ctx.nextUnitId++, spec, def, take());
    const carried = drops[i];
    if (carried && carried.length > 0) ctx.unitDrops[unit.id] = carried;
    add(unit, false);
  });
  if (rs.room.isBoss && rs.room.bossId) {
    const def = data.bosses[rs.room.bossId];
    if (!def) throw new Error(`Unknown boss: ${rs.room.bossId}`);
    const center = { x: Math.floor(board.width / 2), y: Math.floor(board.height / 2) };
    const cell = cheb(center, hero) >= 1 ? center : take();
    add(makeBossUnit(scaling, ctx.nextUnitId++, def, cell), false);
  }
}

function applyRoomEffects(ctx: RaidContext, effects: RoomTypeDef['onEnter']): void {
  const hero = ctx.hero;
  for (const e of effects) {
    if (e.kind === 'damagePctMaxHp') {
      // Traps hurt but never kill: at least 1 HP stays.
      const amount = round2(Math.min(hero.maxHp * e.value, hero.hp - 1));
      if (amount > 0) dealDamage(ctx, hero, amount, ENVIRONMENT, 'trap', false);
    } else if (e.kind === 'healPctMaxHp') {
      heal(ctx, hero, hero.maxHp * e.value, 'sanctuary');
    }
  }
}

function retargetHero(ctx: RaidContext, rs: RoomState): void {
  const hero = ctx.hero;
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const m of rs.monsters) {
    if (!m.alive || m.hp <= 0) continue;
    const d = cheb(hero, m);
    if (d < bestDist || (d === bestDist && best !== null && m.id < best.id)) {
      best = m;
      bestDist = d;
    }
  }
  hero.targetId = best ? best.id : null;
  hero.retargetIn = ctx.data.balance.combat.retargetTicks;
}

function stepTo(ctx: RaidContext, unit: Unit, cell: Cell): void {
  emit(ctx, {
    type: 'Move',
    tick: ctx.tick,
    unit: unit.id,
    from: { x: unit.x, y: unit.y },
    to: cell,
    duration: unit.ticksPerCell,
  });
  unit.x = cell.x;
  unit.y = cell.y;
  unit.moveTimer = unit.ticksPerCell;
}

function monsterTouch(ctx: RaidContext, attacker: Unit, dmg: number, crit: boolean): void {
  const hero = ctx.hero;
  const dealt = dealDamage(ctx, hero, dmg, attacker.id, 'attack', crit);
  // Reflect: a share of the damage taken goes back to the attacker (and never reflects again).
  let reflect = 0;
  for (const e of ctx.effects) if (e.type === 'reflect') reflect += e.value;
  if (reflect > 0 && dealt > 0 && attacker.hp > 0) {
    const back = round2(dealt * reflect);
    if (back > 0) dealDamage(ctx, attacker, back, hero.id, 'reflect', false);
  }
}

function heroLifesteal(ctx: RaidContext, dealt: number): void {
  let rate = 0;
  for (const e of ctx.effects) if (e.type === 'lifesteal') rate += e.value;
  if (rate > 0 && dealt > 0) heal(ctx, ctx.hero, dealt * rate, 'lifesteal');
}

function attack(ctx: RaidContext, rs: RoomState, attacker: Unit, target: Unit): void {
  const rng = ctx.rng;
  // Fixed roll order: accuracy first, then crit (both always consumed).
  const hitRoll = rng.next();
  const critRoll = rng.next();
  const isHero = attacker.side === 'hero';
  const hit = hitRoll < Math.min(1, Math.max(0, attacker.accuracy));
  let crit = hit && critRoll < attacker.critChance;
  let bonus = 0;

  if (isHero) {
    ctx.effects.forEach((e, i) => {
      if (e.type === 'everyNthAttack') {
        const n = e.n ?? 5;
        ctx.counters[i] = (ctx.counters[i] ?? 0) + 1;
        if ((ctx.counters[i] ?? 0) % n === 0) bonus += e.value;
      } else if (e.type === 'firstStrike') {
        if (!rs.firstAttackDone) bonus += e.value;
      } else if (e.type === 'executeBonus') {
        if (target.hp < (e.threshold ?? 0.3) * target.maxHp) bonus += e.value;
      }
    });
    if (hit && !rs.firstAttackDone && rs.mods.guaranteedFirstCrit) crit = true;
    rs.firstAttackDone = true;
  }

  emit(ctx, { type: 'Attack', tick: ctx.tick, unit: attacker.id, target: target.id, hit, crit });
  attacker.cooldown = attacker.cooldownTicks;
  if (!hit) return;

  const mult = 1 + bonus;
  const critMult = crit ? attacker.critMult : 1;
  const dmg = round2(defReduction(attacker.atk * mult, target.def) * critMult);
  if (!isHero) {
    monsterTouch(ctx, attacker, dmg, crit);
    return;
  }
  let dealt = dealDamage(ctx, target, dmg, attacker.id, 'attack', crit);
  if (ctx.trait.kind === 'aoe') {
    for (const m of rs.monsters) {
      if (m === target || !m.alive || m.hp <= 0) continue;
      if (cheb(m, target) > ctx.trait.radius) continue;
      const splash = round2(defReduction(attacker.atk * mult, m.def) * critMult * ctx.trait.value);
      dealt += dealDamage(ctx, m, splash, attacker.id, 'splash', crit);
    }
  }
  heroLifesteal(ctx, dealt);
}

function actUnit(ctx: RaidContext, rs: RoomState, u: Unit): void {
  if (u.cooldown > 0) u.cooldown--;
  if (u.moveTimer > 0) u.moveTimer--;
  const hero = ctx.hero;

  let target: Unit | null = null;
  if (u.side === 'hero') {
    if (u.targetId !== null) {
      target = rs.monsters.find((m) => m.id === u.targetId) ?? null;
    }
    u.retargetIn--;
    if (!target || !target.alive || target.hp <= 0 || u.retargetIn <= 0) {
      retargetHero(ctx, rs);
      target = u.targetId !== null ? (rs.monsters.find((m) => m.id === u.targetId) ?? null) : null;
    }
  } else if (hero.alive && hero.hp > 0) {
    target = hero;
  }
  if (!target) return;

  const dist = cheb(u, target);
  const blocked = (x: number, y: number): boolean => occupied(ctx, rs, x, y);
  if (dist <= u.range) {
    if (u.keepDistance > 0 && dist < u.keepDistance) {
      const spot = findRetreat(ctx.board, u, target, blocked);
      if (spot) {
        if (u.moveTimer === 0) stepTo(ctx, u, spot);
        return;
      }
    }
    if (u.cooldown === 0) attack(ctx, rs, u, target);
  } else if (u.moveTimer === 0) {
    const step = findStep(ctx.board, u, target, u.range, blocked);
    if (step) stepTo(ctx, u, step);
  }
}

function bossPhases(ctx: RaidContext, rs: RoomState, scaling: ScalingContext): void {
  for (const boss of [...rs.monsters]) {
    if (!boss.isBoss || !boss.alive || boss.hp <= 0 || boss.phase !== 1) continue;
    const def = ctx.data.bosses[boss.monsterId];
    if (!def || boss.hp > def.phase.hpThreshold * boss.maxHp) continue;
    boss.phase = 2;
    boss.aspd *= def.phase.aspdMult;
    boss.cooldownTicks = cooldownTicksFor(ctx.data.balance.combat.tickRate, boss.aspd);
    emit(ctx, { type: 'PhaseChange', tick: ctx.tick, unit: boss.id, phase: 2 });
    const minionDef = ctx.data.monsters[def.phase.summonMonsterId];
    if (!minionDef) continue;
    for (let i = 0; i < def.phase.summonCount; i++) {
      const cell = freeCellNear(ctx, rs, boss);
      if (!cell) break;
      const unit = makeMonsterUnit(
        scaling,
        ctx.nextUnitId++,
        { monsterId: minionDef.id, elite: false },
        minionDef,
        cell,
      );
      rs.monsters.push(unit);
      ctx.names[unit.id] = unit.monsterId;
      emit(ctx, {
        type: 'Spawn',
        tick: ctx.tick,
        unit: unit.id,
        monsterId: unit.monsterId,
        elite: false,
        boss: false,
        summoned: true,
        x: unit.x,
        y: unit.y,
        hp: unit.hp,
        maxHp: unit.maxHp,
      });
    }
  }
}

/** Nearest free cell around `center`, scanning rings outwards and rows top to bottom. */
function freeCellNear(ctx: RaidContext, rs: RoomState, center: Cell): Cell | null {
  const maxR = Math.max(ctx.board.width, ctx.board.height);
  for (let r = 1; r <= maxR; r++) {
    for (let y = center.y - r; y <= center.y + r; y++) {
      for (let x = center.x - r; x <= center.x + r; x++) {
        if (cheb({ x, y }, center) !== r || !inBoard(ctx.board, x, y)) continue;
        if (!occupied(ctx, rs, x, y)) return { x, y };
      }
    }
  }
  return null;
}

function processDeaths(ctx: RaidContext, rs: RoomState): void {
  const hero = ctx.hero;
  if (hero.alive && hero.hp <= 0) {
    hero.alive = false;
    emit(ctx, {
      type: 'Death',
      tick: ctx.tick,
      unit: hero.id,
      killer: ctx.lastHitBy[hero.id] ?? ENVIRONMENT,
    });
  }
  for (const m of rs.monsters) {
    if (!m.alive || m.hp > 0) continue;
    m.alive = false;
    const killer = ctx.lastHitBy[m.id] ?? 0;
    emit(ctx, { type: 'Death', tick: ctx.tick, unit: m.id, killer });
    if (killer === hero.id) ctx.kills++;
    collectDrops(ctx, m);
    if (hero.alive && killer === hero.id && ctx.trait.kind === 'healOnKill') {
      heal(ctx, hero, hero.maxHp * ctx.trait.value, 'kill');
    }
  }
}

/** Plays one room: spawns, onEnter effects, then fixed 20 Hz ticks until cleared, dead or timeout. */
export function fightRoom(
  ctx: RaidContext,
  room: RoomInstance,
  type: RoomTypeDef,
  mods: RoomMods,
  entry: Cell,
  specs: readonly SpawnSpec[],
  drops: readonly (DropSpec[] | undefined)[],
): RoomOutcome {
  const hero = ctx.hero;
  hero.x = entry.x;
  hero.y = entry.y;
  hero.targetId = null;
  hero.retargetIn = 0;
  hero.aspd = ctx.heroBase.aspd * mods.heroAspdMult;
  hero.cooldownTicks = cooldownTicksFor(ctx.data.balance.combat.tickRate, hero.aspd);
  hero.accuracy = ctx.heroBase.accuracy * mods.accuracyMult;

  const rs: RoomState = { room, type, mods, monsters: [], firstAttackDone: false };
  const scaling: ScalingContext = { data: ctx.data, levelMult: ctx.levelMult, mods };
  spawnMonsters(ctx, rs, scaling, specs, drops);
  applyRoomEffects(ctx, type.onEnter);

  const cleared = (): boolean => rs.monsters.every((m) => !m.alive);
  const finishRoom = (): RoomOutcome => {
    emit(ctx, { type: 'RoomCleared', tick: ctx.tick, roomKey: `${room.pos.x},${room.pos.y}` });
    grantClearRewards(ctx, type, mods);
    if (mods.healOnClearPct > 0) heal(ctx, hero, hero.maxHp * mods.healOnClearPct, 'fountain');
    return 'cleared';
  };
  if (cleared()) return finishRoom();

  for (;;) {
    if (ctx.tick >= ctx.tickLimit) return 'timeout';
    ctx.tick++;
    const order: Unit[] = [hero, ...rs.monsters];
    for (const u of order) {
      if (u.alive) actUnit(ctx, rs, u);
    }
    bossPhases(ctx, rs, scaling);
    processDeaths(ctx, rs);
    if (!hero.alive) return 'died';
    if (cleared()) return finishRoom();
  }
}
