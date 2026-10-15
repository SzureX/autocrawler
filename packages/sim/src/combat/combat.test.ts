import { describe, expect, it } from 'vitest';
import type { GameData } from '@loch/data';
import { cheb } from './board';
import { hashRaidLog, simulateRaid } from './raid';
import type { RaidEvent } from './types';
import { cloneData, replay, scenario, testData } from '../testing';

const rat = { monsterId: 'rat', elite: false };
const skeleton = { monsterId: 'skeleton', elite: false };
const brute = { monsterId: 'brute', elite: false };

const events = <T extends RaidEvent['type']>(
  log: readonly RaidEvent[],
  type: T,
): Extract<RaidEvent, { type: T }>[] =>
  log.filter((e): e is Extract<RaidEvent, { type: T }> => e.type === type);

/** Data with no randomness in hit/crit so damage numbers are exact. */
const exact = (mutate?: (d: GameData) => void): GameData =>
  cloneData((d) => {
    for (const c of Object.values(d.classes)) c.stats.critChance = 0;
    mutate?.(d);
  });

describe('simulateRaid basics', () => {
  it('is deterministic: same seed -> identical log hash', () => {
    const a = scenario({ seed: 42, rooms: [{ x: 4, y: 4, spawns: [skeleton, rat, rat] }] });
    const b = scenario({ seed: 42, rooms: [{ x: 4, y: 4, spawns: [skeleton, rat, rat] }] });
    const ra = simulateRaid(a.data, a.run);
    const rb = simulateRaid(b.data, b.run);
    expect(hashRaidLog(ra.log)).toBe(hashRaidLog(rb.log));
    expect(ra.log.length).toBeGreaterThan(10);
  });

  it('a different raid attempt gives a different (but reproducible) run', () => {
    const { data, run } = scenario({
      seed: 42,
      rooms: [{ x: 4, y: 4, spawns: [skeleton, rat, rat] }],
    });
    const h0 = hashRaidLog(simulateRaid(data, run, { attempt: 0 }).log);
    const h1 = hashRaidLog(simulateRaid(data, run, { attempt: 1 }).log);
    expect(h0).not.toBe(h1);
    expect(hashRaidLog(simulateRaid(data, run, { attempt: 1 }).log)).toBe(h1);
  });

  it('skipping the log does not change the outcome', () => {
    const { data, run } = scenario({ seed: 7, rooms: [{ x: 4, y: 4, spawns: [skeleton, rat] }] });
    const full = simulateRaid(data, run);
    const lean = simulateRaid(data, run, { recordLog: false });
    expect(lean.log).toEqual([]);
    expect([lean.won, lean.ticks, lean.heroHp]).toEqual([full.won, full.ticks, full.heroHp]);
  });

  it('wins a trivial room and logs the whole story', () => {
    const { data, run } = scenario({ rooms: [{ x: 4, y: 4, spawns: [rat] }] });
    const r = simulateRaid(data, run);
    expect(r.won).toBe(true);
    expect(r.reason).toBe('cleared');
    expect(r.roomsCleared).toBe(1);
    const types = r.log.map((e) => e.type);
    for (const t of [
      'RaidStart',
      'RoomEnter',
      'Spawn',
      'Move',
      'Attack',
      'Damage',
      'Death',
      'RoomCleared',
      'RaidEnd',
    ]) {
      expect(types).toContain(t);
    }
    expect(r.log[0]?.type).toBe('RaidStart');
    expect(r.log[r.log.length - 1]).toMatchObject({ type: 'RaidEnd', won: true });
    expect(r.kills).toBe(1);
  });

  it('log ticks never decrease', () => {
    const { data, run } = scenario({ rooms: [{ x: 4, y: 4, spawns: [skeleton, rat, rat] }] });
    let last = 0;
    for (const e of simulateRaid(data, run).log) {
      expect(e.tick).toBeGreaterThanOrEqual(last);
      last = e.tick;
    }
  });

  it('keeps units on the board, one per cell, moving one adjacent cell at a time', () => {
    const { data, run } = scenario({
      seed: 3,
      rooms: [{ x: 4, y: 4, spawns: [rat, rat, skeleton, archer(), brute] }],
    });
    const { log } = simulateRaid(data, run);
    const board = data.balance.combat.board;
    replay(log, (e, s) => {
      if (e.type === 'Spawn') {
        expect(e.x).toBeGreaterThanOrEqual(0);
        expect(e.x).toBeLessThan(board.width);
        expect(e.y).toBeGreaterThanOrEqual(0);
        expect(e.y).toBeLessThan(board.height);
        expect(Object.values(s.pos)).not.toContainEqual({ x: e.x, y: e.y });
      }
      if (e.type === 'Move') {
        expect(s.pos[e.unit]).toEqual(e.from);
        expect(cheb(e.from, e.to)).toBe(1);
        expect(e.to.x).toBeGreaterThanOrEqual(0);
        expect(e.to.y).toBeGreaterThanOrEqual(0);
        expect(e.to.x).toBeLessThan(board.width);
        expect(e.to.y).toBeLessThan(board.height);
        const others = Object.entries(s.pos).filter(([id]) => Number(id) !== e.unit);
        expect(others.map(([, p]) => p)).not.toContainEqual(e.to);
      }
    });
  });
});

function archer() {
  return { monsterId: 'archer', elite: false };
}

describe('timing', () => {
  it('hero attacks every round(20 / aspd) ticks', () => {
    // Rogue aspd 1.6 -> 13 ticks; a brute soaks up many attacks.
    const { data, run } = scenario({
      data: exact(),
      classId: 'rogue',
      rooms: [{ x: 4, y: 4, spawns: [brute] }],
    });
    const ticks = events(simulateRaid(data, run).log, 'Attack')
      .filter((e) => e.unit === 0)
      .map((e) => e.tick);
    expect(ticks.length).toBeGreaterThan(5);
    for (let i = 1; i < ticks.length; i++) {
      expect((ticks[i] ?? 0) - (ticks[i - 1] ?? 0)).toBe(13);
    }
  });

  it('units step every round(20 / moveSpeed) ticks', () => {
    const { data, run } = scenario({ rooms: [{ x: 4, y: 4, spawns: [brute] }] });
    const { log } = simulateRaid(data, run);
    const heroMoves = events(log, 'Move').filter((e) => e.unit === 0);
    expect(heroMoves[0]?.duration).toBe(8); // 20 / 2.5
    const ticks = heroMoves.map((e) => e.tick);
    for (let i = 1; i < ticks.length; i++) {
      expect((ticks[i] ?? 0) - (ticks[i - 1] ?? 0)).toBeGreaterThanOrEqual(8);
    }
    const bruteMoves = events(log, 'Move').filter((e) => e.unit !== 0);
    expect(bruteMoves[0]?.duration).toBe(14); // round(20 / 1.4)
  });
});

describe('range and targeting', () => {
  it('melee hero attacks only from adjacent cells, the mage from up to 4 cells', () => {
    for (const [classId, range] of [
      ['warrior', 1],
      ['mage', 4],
    ] as const) {
      const { data, run } = scenario({
        classId,
        seed: 5,
        rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton, rat] }],
      });
      let farthest = 0;
      replay(simulateRaid(data, run).log, (e, s) => {
        if (e.type !== 'Attack' || e.unit !== 0) return;
        const a = s.pos[0];
        const t = s.pos[e.target];
        if (!a || !t) throw new Error('missing position');
        const d = cheb(a, t);
        farthest = Math.max(farthest, d);
        expect(d).toBeLessThanOrEqual(range);
      });
      if (classId === 'mage') expect(farthest).toBeGreaterThan(1);
    }
  });

  it('the hero targets the nearest enemy (lower id breaks ties)', () => {
    const { data, run } = scenario({
      seed: 11,
      rooms: [{ x: 4, y: 4, spawns: [rat, skeleton, skeleton] }],
    });
    let checked = 0;
    replay(simulateRaid(data, run).log, (e, s) => {
      if (e.type !== 'Attack' || e.unit !== 0) return;
      const hero = s.pos[0];
      const target = s.pos[e.target];
      if (!hero || !target) return;
      // Only enemies that were alive are in `hp > 0`.
      const dists = Object.keys(s.pos)
        .map(Number)
        .filter((id) => id !== 0 && (s.hp[id] ?? 0) > 0)
        .map((id) => cheb(hero, s.pos[id] ?? hero));
      // Retargeting happens every 10 ticks, so allow some slack: never attack a far-off unit
      // while an adjacent one exists.
      expect(cheb(hero, target)).toBeLessThanOrEqual(Math.min(...dists) + 1);
      checked++;
    });
    expect(checked).toBeGreaterThan(3);
  });

  it('archers retreat to keep distance and shoot when cornered', () => {
    const { data, run } = scenario({ seed: 9, rooms: [{ x: 4, y: 4, spawns: [archer()] }] });
    const log = simulateRaid(data, run).log;
    const archerId = events(log, 'Spawn')[0]?.unit ?? -1;
    const retreats = events(log, 'Move').filter((e) => e.unit === archerId);
    expect(retreats.length).toBeGreaterThan(0);
    expect(events(log, 'Attack').some((e) => e.unit === archerId)).toBe(true);
  });
});

describe('damage rules', () => {
  it('damage = atk * 100 / (100 + def), at least 1, rounded to 0.01', () => {
    // warrior atk 10 vs skeleton def 4 -> 9.62
    const { data, run } = scenario({ data: exact(), rooms: [{ x: 4, y: 4, spawns: [skeleton] }] });
    const hits = events(simulateRaid(data, run).log, 'Damage').filter((e) => e.unit !== 0);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) expect(h.amount).toBeCloseTo(9.62, 2);
    // A tiny attack still deals 1.
    const weak = scenario({
      data: exact((d) => {
        const w = d.classes['warrior'];
        if (w) w.stats.atk = 0.5;
      }),
      rooms: [{ x: 4, y: 4, spawns: [brute] }],
    });
    const first = events(simulateRaid(weak.data, weak.run).log, 'Damage').find((e) => e.unit !== 0);
    expect(first?.amount).toBe(1);
  });

  it('a guaranteed crit multiplies by critMult, zero accuracy never hits', () => {
    const crit = scenario({
      data: cloneData((d) => {
        const w = d.classes['warrior'];
        if (w) w.stats.critChance = 1;
      }),
      rooms: [{ x: 4, y: 4, spawns: [skeleton] }],
    });
    const hits = events(simulateRaid(crit.data, crit.run).log, 'Damage').filter(
      (e) => e.unit !== 0,
    );
    for (const h of hits) {
      expect(h.crit).toBe(true);
      expect(h.amount).toBeCloseTo(9.62 * 1.5, 1);
    }
    const blind = scenario({
      data: cloneData((d) => {
        const w = d.classes['warrior'];
        if (w) w.stats.accuracy = 0;
        d.balance.combat.tickLimit = 400;
      }),
      rooms: [{ x: 4, y: 4, spawns: [skeleton] }],
    });
    const r = simulateRaid(blind.data, blind.run);
    const heroAttacks = events(r.log, 'Attack').filter((e) => e.unit === 0);
    expect(heroAttacks.length).toBeGreaterThan(0);
    expect(heroAttacks.every((a) => !a.hit)).toBe(true);
  });

  it('monster HP and ATK scale with the dungeon level', () => {
    const lvl1 = scenario({ rooms: [{ x: 4, y: 4, spawns: [skeleton] }], wavesWon: 0 });
    const lvl10 = scenario({ rooms: [{ x: 4, y: 4, spawns: [skeleton] }], wavesWon: 9 });
    const hp = (s: ReturnType<typeof scenario>): number =>
      events(simulateRaid(s.data, s.run).log, 'Spawn')[0]?.maxHp ?? 0;
    expect(hp(lvl1)).toBe(45);
    expect(hp(lvl10)).toBe(Math.round(45 * 3.0));
  });

  it('elites have +150% HP and +50% ATK', () => {
    const { data, run } = scenario({
      rooms: [{ x: 4, y: 4, spawns: [{ monsterId: 'skeleton', elite: true }] }],
    });
    const spawn = events(simulateRaid(data, run).log, 'Spawn')[0];
    expect(spawn?.maxHp).toBe(Math.round(45 * 2.5));
    expect(spawn?.elite).toBe(true);
  });
});

describe('class and artifact effects', () => {
  it('mage splash hits nearby enemies for 60% of the damage', () => {
    let splashes = 0;
    for (let seed = 1; seed <= 8; seed++) {
      const { data, run } = scenario({
        data: exact(),
        classId: 'mage',
        seed,
        rooms: [{ x: 4, y: 4, spawns: [rat, rat, rat, rat, skeleton] }],
      });
      replay(simulateRaid(data, run).log, (e, s) => {
        if (e.type !== 'Damage' || e.kind !== 'splash') return;
        splashes++;
        const def = s.monsterId[e.unit] === 'skeleton' ? 4 : 0;
        expect(e.amount).toBeCloseTo(((16 * 100) / (100 + def)) * 0.6, 1);
      });
    }
    expect(splashes).toBeGreaterThan(0);
  });

  it('splash never fires for non-mage classes', () => {
    const { data, run } = scenario({ rooms: [{ x: 4, y: 4, spawns: [rat, rat, rat] }] });
    expect(events(simulateRaid(data, run).log, 'Damage').some((e) => e.kind === 'splash')).toBe(
      false,
    );
  });

  it('warrior heals 3% max HP per kill', () => {
    const { data, run } = scenario({
      data: exact(),
      rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton, rat] }],
    });
    const log = simulateRaid(data, run).log;
    const kills = events(log, 'Heal').filter((e) => e.source === 'kill');
    // Heals only register when the hero is hurt; each heal is at most 3.6 (120 * 3%).
    expect(kills.length).toBeGreaterThan(0);
    for (const k of kills) expect(k.amount).toBeLessThanOrEqual(3.6 + 1e-9);
    const rogue = scenario({ classId: 'rogue', rooms: [{ x: 4, y: 4, spawns: [skeleton, rat] }] });
    expect(
      events(simulateRaid(rogue.data, rogue.run).log, 'Heal').some((e) => e.source === 'kill'),
    ).toBe(false);
  });

  it('lifesteal heals 5% of damage dealt', () => {
    // Hurt the hero first (skeletons), then check lifesteal heals.
    const { data, run } = scenario({
      data: exact(),
      equipment: ['vampire_stone'],
      rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton, skeleton] }],
    });
    const log = simulateRaid(data, run).log;
    const heals = events(log, 'Heal').filter((e) => e.source === 'lifesteal');
    expect(heals.length).toBeGreaterThan(0);
    for (const h of heals) expect(h.amount).toBeLessThanOrEqual(9.62 * 0.05 + 0.011);
  });

  it('a level 3 lifesteal heals 20%', () => {
    const { data, run } = scenario({
      data: exact(),
      equipment: [{ id: 'vampire_stone', level: 3 }],
      rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton, skeleton] }],
    });
    const heals = events(simulateRaid(data, run).log, 'Heal').filter(
      (e) => e.source === 'lifesteal',
    );
    expect(heals.length).toBeGreaterThan(0);
    expect(Math.max(...heals.map((h) => h.amount))).toBeGreaterThan(9.62 * 0.05 + 0.02);
    for (const h of heals) expect(h.amount).toBeLessThanOrEqual(9.62 * 0.2 + 0.011);
  });

  it('reflect returns 15% of damage taken and never reflects again', () => {
    const { data, run } = scenario({
      data: exact(),
      equipment: ['thorn_spikes'],
      rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton] }],
    });
    const log = simulateRaid(data, run).log;
    const reflects = events(log, 'Damage').filter((e) => e.kind === 'reflect');
    expect(reflects.length).toBeGreaterThan(0);
    for (const r of reflects) {
      expect(r.unit).not.toBe(0); // only monsters take reflected damage
      expect(r.source).toBe(0);
    }
    // Each reflect directly follows the monster hit it answers.
    log.forEach((e, i) => {
      if (e.type === 'Damage' && e.kind === 'reflect') {
        const prev = log[i - 1];
        expect(prev?.type).toBe('Damage');
        if (prev?.type === 'Damage') {
          expect(prev.unit).toBe(0);
          expect(e.amount).toBeCloseTo(prev.amount * 0.15, 1);
        }
      }
    });
  });

  it('executeBonus adds +50% against targets below 30% HP', () => {
    const { data, run } = scenario({
      data: exact(),
      equipment: ['headhunter_ring'],
      rooms: [{ x: 4, y: 4, spawns: [brute] }],
    });
    const base = (10 * 100) / (100 + 8);
    let low = 0;
    let high = 0;
    replay(simulateRaid(data, run).log, (e, s) => {
      if (e.type !== 'Damage' || e.unit === 0 || e.kind !== 'attack') return;
      const prev = s.hp[e.unit] ?? 0;
      const frac = prev / (s.maxHp[e.unit] ?? 1);
      if (frac < 0.3) {
        low++;
        expect(e.amount).toBeCloseTo(base * 1.5, 1);
      } else {
        high++;
        expect(e.amount).toBeCloseTo(base, 1);
      }
    });
    expect(low).toBeGreaterThan(0);
    expect(high).toBeGreaterThan(0);
  });

  it('echo hammer: every 5th attack deals double damage', () => {
    const { data, run } = scenario({
      data: exact(),
      equipment: ['echo_hammer'],
      rooms: [{ x: 4, y: 4, spawns: [brute, brute] }],
    });
    const hero = events(simulateRaid(data, run).log, 'Damage').filter((e) => e.unit !== 0);
    const base = (10 * 100) / (100 + 8);
    expect(hero.length).toBeGreaterThanOrEqual(10);
    hero.forEach((h, i) => {
      const expected = (i + 1) % 5 === 0 ? base * 2 : base;
      expect(h.amount).toBeCloseTo(expected, 1);
    });
  });

  it('two echo hammers keep separate counters', () => {
    const { data, run } = scenario({
      data: exact(),
      equipment: ['echo_hammer', 'echo_hammer'],
      rooms: [{ x: 4, y: 4, spawns: [brute, brute] }],
    });
    const hits = events(simulateRaid(data, run).log, 'Damage').filter((e) => e.unit !== 0);
    const base = (10 * 100) / (100 + 8);
    hits.forEach((h, i) => {
      expect(h.amount).toBeCloseTo((i + 1) % 5 === 0 ? base * 3 : base, 1);
    });
  });

  it('first strike doubles the first attack in every room', () => {
    const { data, run } = scenario({
      data: exact(),
      equipment: ['first_blow_signet'],
      rooms: [
        { x: 4, y: 4, doors: ['E'], spawns: [brute] },
        { x: 5, y: 4, doors: ['W'], spawns: [brute] },
      ],
    });
    const r = simulateRaid(data, run);
    const base = (10 * 100) / (100 + 8);
    let roomFirst = true;
    let doubled = 0;
    for (const e of r.log) {
      if (e.type === 'RoomEnter' && !e.transit) roomFirst = true;
      if (e.type === 'Damage' && e.unit !== 0 && e.kind === 'attack') {
        if (roomFirst) {
          expect(e.amount).toBeCloseTo(base * 2, 1);
          doubled++;
        } else expect(e.amount).toBeCloseTo(base, 1);
        roomFirst = false;
      }
    }
    expect(doubled).toBe(2);
  });
});

describe('room effects', () => {
  it('a temple holds no monsters and heals 30% max HP on entry', () => {
    // Fight in the first room, arrive hurt in the temple.
    const { data, run } = scenario({
      data: exact(),
      rooms: [
        { x: 4, y: 4, doors: ['E'], spawns: [skeleton, rat] },
        { x: 5, y: 4, doors: ['W'], roomTypeId: 'temple' },
      ],
    });
    const log = simulateRaid(data, run).log;
    const heal = events(log, 'Heal').find((e) => e.source === 'temple');
    expect(heal).toBeDefined();
    expect(heal?.amount).toBeGreaterThan(0);
    expect(heal?.amount).toBeLessThanOrEqual(36 + 1e-9);
    const enter = events(log, 'RoomEnter').filter((e) => e.roomKey === '5,4' && !e.transit);
    expect(enter).toHaveLength(1);
    expect(enter[0]?.chest).toBeNull();
    // No monster is ever spawned in the temple.
    expect(events(log, 'Spawn').every((e) => e.tick < (enter[0]?.tick ?? 0))).toBe(true);
  });

  it('the hero walks to the front of the chest, opens it and leaves', () => {
    const { data, run } = scenario({
      rooms: [
        { x: 4, y: 4, doors: ['E'], roomTypeId: 'chest' },
        { x: 5, y: 4, doors: ['W'], spawns: [rat] },
      ],
    });
    const result = simulateRaid(data, run);
    expect(result.won).toBe(true);
    const log = result.log;
    const { chest } = data.balance.combat;
    const enter = events(log, 'RoomEnter').find((e) => !e.transit);
    expect(enter?.chest).toEqual({ x: chest.x, y: chest.y });
    const open = events(log, 'ChestOpen');
    expect(open).toHaveLength(1);
    expect(open[0]?.cell).toEqual({ x: chest.x, y: chest.y });
    // The last step of the walk ends one cell below the chest (its front faces south).
    const moves = events(log, 'Move').filter(
      (e) => e.unit === 0 && e.tick >= (enter?.tick ?? 0) && e.tick < (open[0]?.tick ?? 0),
    );
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.at(-1)?.to).toEqual({ x: chest.x, y: chest.y + 1 });
    // The hero never steps onto the chest cell.
    expect(moves.some((m) => m.to.x === chest.x && m.to.y === chest.y)).toBe(false);
    // The walk takes real time, and the lid takes openTicks.
    const walkTicks = moves.reduce((sum, m) => sum + m.duration, 0);
    expect((open[0]?.tick ?? 0) - (enter?.tick ?? 0)).toBe(walkTicks);
    const cleared = log.find((e) => e.type === 'RoomCleared' && e.roomKey === '4,4');
    expect(cleared?.tick).toBe((open[0]?.tick ?? 0) + chest.openTicks);
  });

  it('a trap is decided anew in every raid: a chest or a fight with one monster', () => {
    let chests = 0;
    let fights = 0;
    const n = 200;
    for (let attempt = 0; attempt < n; attempt++) {
      const { data, run } = scenario({
        seed: 5,
        rooms: [{ x: 4, y: 4, roomTypeId: 'trap_room' }],
      });
      const log = simulateRaid(data, run, { attempt }).log;
      const enter = events(log, 'RoomEnter').find((e) => !e.transit);
      const spawns = events(log, 'Spawn');
      if (enter?.chest) {
        chests++;
        expect(spawns).toHaveLength(0);
        expect(events(log, 'ChestOpen')).toHaveLength(1);
      } else {
        fights++;
        expect(spawns).toHaveLength(1);
        expect(spawns[0]?.elite).toBe(false);
        expect(events(log, 'ChestOpen')).toHaveLength(0);
      }
      // A trap no longer hurts the hero by itself.
      expect(events(log, 'Damage').some((e) => e.kind === 'trap')).toBe(false);
    }
    expect(chests / n).toBeGreaterThan(0.4);
    expect(chests / n).toBeLessThan(0.6);
    expect(chests + fights).toBe(n);
  });

  it('the trap roll is reproducible for the same seed and raid attempt', () => {
    const { data, run } = scenario({ seed: 9, rooms: [{ x: 4, y: 4, roomTypeId: 'trap_room' }] });
    const a = simulateRaid(data, run, { attempt: 3 });
    const b = simulateRaid(data, run, { attempt: 3 });
    expect(hashRaidLog(a.log)).toBe(hashRaidLog(b.log));
  });

  it('a room with upgrades: fountain heals after clearing, torches speed up the hero', () => {
    const base = scenario({ rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton] }] });
    const torches = scenario({
      rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton], upgradeId: 'torches' }],
    });
    const aBase = events(simulateRaid(base.data, base.run).log, 'Attack').filter(
      (e) => e.unit === 0,
    );
    const aTorch = events(simulateRaid(torches.data, torches.run).log, 'Attack').filter(
      (e) => e.unit === 0,
    );
    const gap = (list: typeof aBase): number => (list[1]?.tick ?? 0) - (list[0]?.tick ?? 0);
    expect(gap(aBase)).toBe(20);
    expect(gap(aTorch)).toBe(17); // round(20 / 1.15)
    const fountain = scenario({
      data: exact(),
      rooms: [{ x: 4, y: 4, spawns: [skeleton, rat], upgradeId: 'fountain' }],
    });
    const heal = events(simulateRaid(fountain.data, fountain.run).log, 'Heal').find(
      (e) => e.source === 'fountain',
    );
    expect(heal).toBeDefined();
  });

  it('upgrades change the outcome for the same seed', () => {
    const plain = scenario({ seed: 5, rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton, rat] }] });
    const gated = scenario({
      seed: 5,
      rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton, rat], upgradeId: 'guardian_gate' }],
    });
    expect(hashRaidLog(simulateRaid(plain.data, plain.run).log)).not.toBe(
      hashRaidLog(simulateRaid(gated.data, gated.run).log),
    );
  });
});

describe('the boss', () => {
  const strong = (): GameData =>
    cloneData((d) => {
      const w = d.classes['warrior'];
      if (w) {
        w.stats.atk = 120;
        w.stats.maxHp = 5000;
        w.stats.critChance = 0;
      }
    });

  it('changes phase once at 50% HP: summons 2 skeletons and attacks 30% faster', () => {
    const { data, run } = scenario({
      data: strong(),
      wavesWon: 10,
      rooms: [
        { x: 4, y: 4, doors: ['E'], spawns: [rat] },
        { x: 5, y: 4, doors: ['W'], bossId: 'warden' },
      ],
    });
    const r = simulateRaid(data, run);
    expect(r.won).toBe(true);
    const phases = events(r.log, 'PhaseChange');
    expect(phases).toHaveLength(1);
    const summons = events(r.log, 'Spawn').filter((e) => e.summoned);
    expect(summons).toHaveLength(2);
    expect(summons.every((s) => s.monsterId === 'skeleton')).toBe(true);
    // Phase 2 fires when the boss is at or below 50% HP.
    replay(r.log, (e, s) => {
      if (e.type === 'PhaseChange') {
        const hp = s.hp[e.unit] ?? 0;
        const max = s.maxHp[e.unit] ?? 1;
        expect(hp / max).toBeLessThanOrEqual(0.5);
      }
    });
    // Boss attack gaps shrink from round(20/0.8)=25 to round(20/1.04)=19.
    const bossId = events(r.log, 'Spawn').find((e) => e.boss)?.unit ?? -1;
    const bossAttacks = events(r.log, 'Attack')
      .filter((e) => e.unit === bossId)
      .map((e) => e.tick);
    const phaseTick = phases[0]?.tick ?? 0;
    const gaps = bossAttacks.slice(1).map((t, i) => [t, t - (bossAttacks[i] ?? 0)] as const);
    expect(gaps.filter(([t]) => t <= phaseTick).every(([, g]) => g === 25)).toBe(true);
    expect(gaps.filter(([t]) => t > phaseTick + 25).every(([, g]) => g === 19)).toBe(true);
  });

  it('the boss room is visited last and stats scale at level 11', () => {
    const { data, run } = scenario({
      data: strong(),
      wavesWon: 10,
      rooms: [
        { x: 4, y: 4, doors: ['E', 'W'], spawns: [rat] },
        { x: 5, y: 4, doors: ['W'], bossId: 'warden' },
        { x: 3, y: 4, doors: ['E'], spawns: [rat] },
      ],
    });
    const r = simulateRaid(data, run);
    const enters = events(r.log, 'RoomEnter').filter((e) => !e.transit);
    expect(enters[enters.length - 1]?.roomKey).toBe('5,4');
    const boss = events(r.log, 'Spawn').find((e) => e.boss);
    expect(boss?.maxHp).toBe(Math.round(600 * 3.3));
  });
});

describe('raid end conditions', () => {
  it('ends as RaidLost when the hero dies, and reports the killer', () => {
    const { data, run } = scenario({
      data: cloneData((d) => {
        const w = d.classes['warrior'];
        if (w) {
          w.stats.maxHp = 5;
          w.stats.def = 0;
        }
      }),
      rooms: [{ x: 4, y: 4, spawns: [brute, brute, brute] }],
    });
    const r = simulateRaid(data, run);
    expect(r.won).toBe(false);
    expect(r.reason).toBe('died');
    expect(r.death?.killerMonsterId).toBe('brute');
    expect(r.log[r.log.length - 1]).toMatchObject({ type: 'RaidEnd', won: false, reason: 'died' });
  });

  it('times out after the tick limit', () => {
    const { data, run } = scenario({
      data: cloneData((d) => {
        d.balance.combat.tickLimit = 100;
        const w = d.classes['warrior'];
        if (w) w.stats.accuracy = 0;
      }),
      rooms: [{ x: 4, y: 4, spawns: [brute] }],
    });
    const r = simulateRaid(data, run);
    expect(r.reason).toBe('timeout');
    expect(r.won).toBe(false);
    expect(r.ticks).toBeLessThanOrEqual(100);
  });

  it('walking back through cleared rooms costs time', () => {
    const line = scenario({
      rooms: [
        { x: 4, y: 4, doors: ['E'], spawns: [rat] },
        { x: 5, y: 4, doors: ['W', 'E'], spawns: [rat] },
        { x: 6, y: 4, doors: ['W', 'S'], spawns: [rat] },
        { x: 6, y: 5, doors: ['N'], spawns: [rat] },
      ],
    });
    const r = simulateRaid(line.data, line.run);
    expect(r.won).toBe(true);
    expect(r.roomsCleared).toBe(4);
    const enters = events(r.log, 'RoomEnter');
    expect(enters.filter((e) => e.transit)).toHaveLength(0);
    expect(enters.slice(1).every((e) => e.duration > 0)).toBe(true);
    // A branching layout forces a walk through a cleared room.
    const branch = scenario({
      rooms: [
        { x: 4, y: 4, doors: ['N', 'E'], spawns: [rat] },
        { x: 4, y: 3, doors: ['S'], spawns: [rat] },
        { x: 5, y: 4, doors: ['W'], spawns: [rat] },
      ],
    });
    const b = simulateRaid(branch.data, branch.run);
    const bEnters = events(b.log, 'RoomEnter');
    expect(bEnters.map((e) => [e.roomKey, e.transit])).toEqual([
      ['4,4', false],
      ['4,3', false],
      ['4,4', true],
      ['5,4', false],
    ]);
  });
});

describe('robustness', () => {
  it('1000 raids on random dungeons: never hangs, never times out', () => {
    let timeouts = 0;
    let wins = 0;
    for (let seed = 1; seed <= 1000; seed++) {
      const waves = seed % 11;
      const built = buildForRaid(seed, waves);
      const r = simulateRaid(testData, built, { recordLog: false });
      if (r.reason === 'timeout') timeouts++;
      if (r.won) wins++;
      expect(r.ticks).toBeLessThanOrEqual(testData.balance.combat.tickLimit);
    }
    expect(timeouts).toBe(0);
    expect(wins).toBeGreaterThan(0);
  }, 60_000);
});

import { randomBuild } from '../testing';
import { grantArtifact } from '../artifacts';
import { equip } from '../inventory';
import { createRng } from '../rng';
import type { RunState } from '../types';

/** A random dungeon with `waves` built rooms and a few random artifacts equipped. */
function buildForRaid(seed: number, waves: number): RunState {
  const states = randomBuild(seed, waves);
  let run = states[states.length - 1];
  if (!run) throw new Error('no state');
  const rng = createRng(seed).fork('equip');
  const classes = Object.keys(testData.classes);
  run = { ...run, phase: 'Prep', classId: rng.pick(classes), wavesWon: waves, tileOffer: [] };
  const ids = Object.keys(testData.artifacts);
  const count = Math.min(9, waves);
  for (let i = 0; i < count; i++) run = grantArtifact(testData, run, rng.pick(ids));
  for (let i = 0; i < count; i++) {
    const inst = run.backpack[0];
    if (inst) run = equip(run, inst.uid, i);
  }
  return run;
}
