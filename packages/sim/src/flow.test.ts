import { describe, expect, it } from 'vitest';
import type { GameData } from '@loch/data';
import { playRun } from './bots';
import { simulateRaid } from './combat/raid';
import { legalPlacements, placeTile } from './dungeon';
import { continueRun, hasBossRoom, playRaid, resolveRaid, startRaid } from './flow';
import { hashRaidLog } from './combat/raid';
import { createRun } from './run';
import { deserializeRun, serializeRun } from './serialize';
import { chooseTile } from './tiles';
import { cloneData, testData } from './testing';
import type { RunPhase, RunState } from './types';

const mighty = (): GameData =>
  cloneData((d) => {
    for (const c of Object.values(d.classes)) {
      c.stats.maxHp = 100000;
      c.stats.atk = 2000;
      c.stats.def = 1000;
    }
  });
const feeble = (): GameData =>
  cloneData((d) => {
    for (const c of Object.values(d.classes)) {
      c.stats.maxHp = 1;
      c.stats.def = 0;
    }
  });

/** First tile of the offer into Prep and placed on the first legal position. */
function buildFirst(data: GameData, run: RunState): RunState {
  const tile = run.tileOffer[0];
  if (!tile) throw new Error('no offer');
  const prep = chooseTile(run, tile.uid);
  const spot = legalPlacements(data, prep.dungeon, tile)[0];
  if (!spot) throw new Error('no spot');
  return placeTile(data, prep, tile.uid, spot);
}

describe('illegal transitions', () => {
  const run0 = createRun(testData, 1, 'warrior');

  it('Start is blocked until the tile in hand is built', () => {
    const prep = chooseTile(run0, run0.tileOffer[0]?.uid ?? '');
    expect(prep.phase).toBe('Prep');
    expect(() => startRaid(prep)).toThrow(/built/);
    expect(startRaid(buildFirst(testData, run0)).phase).toBe('Action');
  });

  it('phases only accept their own actions', () => {
    expect(() => startRaid(run0)).toThrow(/phase/); // TileOffer
    const prep = buildFirst(testData, run0);
    const action = startRaid(prep);
    const result = simulateRaid(testData, action);
    expect(() => resolveRaid(prep, result)).toThrow(/phase/);
    expect(() => continueRun(testData, action)).toThrow(/phase/);
    expect(() => startRaid(action)).toThrow(/phase/);
    expect(() => chooseTile(action, 'x')).toThrow();
    const resolved = resolveRaid(action, result);
    expect(resolved.phase).toBe('Resolve');
    expect(() => resolveRaid(resolved, result)).toThrow(/phase/);
    expect(() => startRaid(resolved)).toThrow(/phase/);
  });

  it('raidAttempts grows on every raid and the RNG stream follows it', () => {
    const prep = buildFirst(mighty(), createRun(mighty(), 4, 'warrior'));
    const a = startRaid(prep);
    expect(a.raidAttempts).toBe(1);
    const h1 = hashRaidLog(simulateRaid(mighty(), a).log);
    const h2 = hashRaidLog(simulateRaid(mighty(), { ...a, raidAttempts: 2 }).log);
    expect(h1).not.toBe(h2);
  });
});

describe('a won raid', () => {
  it('counts a wave, keeps loot and opens a new tile offer at the next level', () => {
    const data = mighty();
    const prep = buildFirst(data, createRun(data, 8, 'warrior'));
    const { run: resolved, result } = playRaid(data, prep);
    expect(result.won).toBe(true);
    expect(resolved.phase).toBe('Resolve');
    expect(resolved.wavesWon).toBe(1);
    expect(resolved.lives).toBe(5);
    expect(resolved.lastRaid?.won).toBe(true);
    expect(resolved.backpack).toHaveLength(result.lootArtifacts.length);
    const next = continueRun(data, resolved);
    expect(next.phase).toBe('TileOffer');
    expect(next.tileOffer).toHaveLength(3);
    expect(next.stats).toMatchObject({ raids: 1, wins: 1, losses: 0 });
  });
});

describe('a lost raid', () => {
  it('costs a life, gives no tile, keeps the loot and returns to Prep on the same dungeon', () => {
    const data = feeble();
    const prep = buildFirst(data, createRun(data, 8, 'warrior'));
    const rooms = Object.keys(prep.dungeon.rooms).length;
    const { run: resolved, result } = playRaid(data, prep);
    expect(result.won).toBe(false);
    expect(resolved.lives).toBe(4);
    expect(resolved.wavesWon).toBe(0);
    const next = continueRun(data, resolved);
    expect(next.phase).toBe('Prep');
    expect(next.hand).toEqual([]);
    expect(next.tileOffer).toEqual([]);
    expect(Object.keys(next.dungeon.rooms)).toHaveLength(rooms);
    expect(next.backpack).toHaveLength(result.lootArtifacts.length);
    // The same dungeon can be raided again straight away (Start needs no tile).
    expect(startRaid(next).phase).toBe('Action');
  });

  it('the fifth defeat is GameOver', () => {
    const data = feeble();
    let run = buildFirst(data, createRun(data, 8, 'warrior'));
    for (let i = 0; i < 5; i++) {
      expect(run.phase).toBe('Prep');
      run = continueRun(data, playRaid(data, run).run);
    }
    expect(run.phase).toBe('GameOver');
    expect(run.lives).toBe(0);
    expect(run.stats.losses).toBe(5);
  });
});

describe('bot runs through the whole state machine', () => {
  it('wins a full run: 10 waves, boss placed by the player and visited last, Victory', () => {
    const data = mighty();
    const out = playRun(data, 3, 'warrior', 'greedy-atk', { recordLog: true });
    expect(out.outcome).toBe('Victory');
    expect(out.run.phase).toBe('Victory');
    expect(out.run.wavesWon).toBe(10);
    expect(out.raids).toHaveLength(11);
    expect(out.raids.map((r) => r.level)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(hasBossRoom(out.run)).toBe(true);
    // 11th raid ends in the boss room.
    const last = out.raids[10]?.result;
    const enters = last?.log.filter((e) => e.type === 'RoomEnter' && !e.transit) ?? [];
    const bossKey = Object.values(out.run.dungeon.rooms).find((r) => r.isBoss);
    expect(enters[enters.length - 1]).toMatchObject({
      roomKey: `${bossKey?.pos.x},${bossKey?.pos.y}`,
    });
    expect(out.raids.every((r) => r.result.reason !== 'timeout')).toBe(true);
  });

  it('visits every phase on the way to Victory', () => {
    const data = mighty();
    const seen = new Set<RunPhase>();
    let run = createRun(data, 5, 'rogue');
    seen.add(run.phase);
    for (let i = 0; i < 40 && run.phase !== 'Victory'; i++) {
      if (run.phase === 'TileOffer' || run.phase === 'BossOffer') {
        run = chooseTile(run, run.tileOffer[0]?.uid ?? '');
      } else if (run.phase === 'Prep') {
        const tile = run.hand[0];
        if (tile)
          run = placeTile(
            data,
            run,
            tile.uid,
            legalPlacements(data, run.dungeon, tile)[0] ?? { x: 0, y: 0 },
          );
        run = playRaid(data, run).run;
      } else if (run.phase === 'Resolve') run = continueRun(data, run);
      seen.add(run.phase);
    }
    expect([...seen].sort()).toEqual(['Prep', 'Resolve', 'TileOffer', 'Victory'].sort());
    expect(run.hand).toEqual([]);
  });

  it('loses a full run: five defeats end in GameOver without ever offering a tile again', () => {
    const data = feeble();
    const out = playRun(data, 3, 'mage', 'random');
    expect(out.outcome).toBe('GameOver');
    expect(out.run.phase).toBe('GameOver');
    expect(out.run.lives).toBe(0);
    expect(out.raids).toHaveLength(5);
    expect(out.run.wavesWon).toBe(0);
  });

  it('a lost boss raid costs a life and the boss room stays', () => {
    // Strong enough for the 10 waves, then weakened before the boss.
    const data = mighty();
    const out = playRun(data, 6, 'warrior', 'greedy-hp');
    expect(out.outcome).toBe('Victory');
    const weak = cloneData((d) => {
      for (const c of Object.values(d.classes)) {
        c.stats.maxHp = 1;
        c.stats.def = 0;
      }
    });
    // Rebuild a state at the boss gate using the mighty run's dungeon but a feeble hero.
    const gate: RunState = {
      ...out.run,
      phase: 'Prep',
      wavesWon: 10,
      lives: 5,
      hand: [],
      tileOffer: [],
    };
    const lost = continueRun(weak, playRaid(weak, gate).run);
    expect(lost.phase).toBe('Prep');
    expect(lost.lives).toBe(4);
    expect(lost.wavesWon).toBe(10);
    expect(hasBossRoom(lost)).toBe(true);
  });

  it('a normal-strength bot never gets stuck or times out over many runs', () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const bot of ['random', 'greedy-atk', 'greedy-hp'] as const) {
        const out = playRun(
          testData,
          seed,
          ['warrior', 'rogue', 'mage'][seed % 3] ?? 'warrior',
          bot,
        );
        expect(['Victory', 'GameOver']).toContain(out.outcome);
        expect(out.raids.every((r) => r.result.reason !== 'timeout')).toBe(true);
        expect(out.run.wavesWon).toBeLessThanOrEqual(10);
        if (out.outcome === 'GameOver') expect(out.run.lives).toBe(0);
      }
    }
  });

  it('the whole run is deterministic: same seed -> same outcome and loot', () => {
    const a = playRun(testData, 77, 'rogue', 'greedy-atk');
    const b = playRun(testData, 77, 'rogue', 'greedy-atk');
    expect(a.outcome).toBe(b.outcome);
    expect(serializeRun(a.run)).toBe(serializeRun(b.run));
    expect(a.raids.map((r) => r.result.ticks)).toEqual(b.raids.map((r) => r.result.ticks));
  });
});

describe('save and load between phases', () => {
  it('a run saved in any phase continues to exactly the same result', () => {
    const data = mighty();
    let run = createRun(data, 12, 'warrior');
    let reloaded = deserializeRun(serializeRun(run));
    for (let i = 0; i < 12 && run.phase !== 'Victory' && run.phase !== 'GameOver'; i++) {
      const step = (r: RunState): RunState => {
        if (r.phase === 'TileOffer' || r.phase === 'BossOffer')
          return chooseTile(r, r.tileOffer[0]?.uid ?? '');
        if (r.phase === 'Prep') {
          const tile = r.hand[0];
          const base = tile
            ? placeTile(
                data,
                r,
                tile.uid,
                legalPlacements(data, r.dungeon, tile)[0] ?? { x: 0, y: 0 },
              )
            : r;
          return startRaid(base);
        }
        if (r.phase === 'Action') return resolveRaid(r, simulateRaid(data, r));
        return continueRun(data, r);
      };
      run = step(run);
      reloaded = step(reloaded);
      expect(reloaded).toEqual(run);
      reloaded = deserializeRun(serializeRun(reloaded)); // save/load after every step
    }
    expect(run.stats.raids).toBeGreaterThan(2);
  });
});
