import { describe, expect, it } from 'vitest';
import { cloneData, scenario, testData } from './testing';
import { createRun } from './run';
import { continueRun, playRaid, resolveRaid, startRaid } from './flow';
import { simulateRaid } from './combat/raid';
import { deserializeRun, serializeRun, RunParseError } from './serialize';
import { addXp, earnedSkillPoints } from './xp';

const balance = testData.balance;
const { maxLevel, xpPerLevel, xpPerKill } = balance.heroLevel;

describe('hero experience', () => {
  it('uses the agreed numbers: 50 experience per level, 10 per kill, level cap 10', () => {
    expect(xpPerLevel).toBe(50);
    expect(xpPerKill).toBe(10);
    expect(maxLevel).toBe(10);
  });

  it('adds experience without a level up below the threshold', () => {
    expect(addXp(balance, { level: 1, xp: 0 }, 30)).toEqual({ level: 1, xp: 30 });
    expect(addXp(balance, { level: 1, xp: 30 }, 19)).toEqual({ level: 1, xp: 49 });
  });

  it('levels up at exactly the threshold and carries the rest over', () => {
    expect(addXp(balance, { level: 1, xp: 40 }, 10)).toEqual({ level: 2, xp: 0 });
    expect(addXp(balance, { level: 1, xp: 40 }, 25)).toEqual({ level: 2, xp: 15 });
  });

  it('can gain several levels at once', () => {
    expect(addXp(balance, { level: 1, xp: 0 }, 130)).toEqual({ level: 3, xp: 30 });
  });

  it('stops at the level cap: the surplus is dropped and the bar stays full', () => {
    const toCap = (maxLevel - 1) * xpPerLevel;
    expect(addXp(balance, { level: 1, xp: 0 }, toCap)).toEqual({ level: maxLevel, xp: xpPerLevel });
    expect(addXp(balance, { level: 1, xp: 0 }, toCap + 999)).toEqual({
      level: maxLevel,
      xp: xpPerLevel,
    });
    expect(addXp(balance, { level: maxLevel, xp: xpPerLevel }, 500)).toEqual({
      level: maxLevel,
      xp: xpPerLevel,
    });
  });

  it('ignores negative experience', () => {
    expect(addXp(balance, { level: 2, xp: 10 }, -5)).toEqual({ level: 2, xp: 10 });
  });

  it('a skill point comes with every level above the first', () => {
    expect(earnedSkillPoints({ level: 1 })).toBe(0);
    expect(earnedSkillPoints({ level: 4 })).toBe(3);
    expect(earnedSkillPoints({ level: maxLevel })).toBe(maxLevel - 1);
  });
});

describe('experience in a run', () => {
  it('a new run starts at level 1 with no experience', () => {
    const run = createRun(testData, 3, 'warrior');
    expect(run.level).toBe(1);
    expect(run.xp).toBe(0);
  });

  it('a raid earns the fixed amount per kill, also when it is lost', () => {
    const rat = { monsterId: 'rat', elite: false };
    const won = scenario({ rooms: [{ x: 4, y: 4, spawns: [rat, rat, rat] }] });
    const result = simulateRaid(won.data, won.run);
    expect(result.won).toBe(true);
    expect(result.kills).toBe(3);
    expect(result.xpGained).toBe(3 * xpPerKill);
    const lost = scenario({
      data: cloneData((d) => {
        for (const c of Object.values(d.classes)) c.stats.maxHp = 1;
      }),
      rooms: [{ x: 4, y: 4, spawns: [rat, rat, rat] }],
    });
    const lostResult = simulateRaid(lost.data, lost.run);
    expect(lostResult.xpGained).toBe(lostResult.kills * xpPerKill);
  });

  it('the experience reaches the hero when the run moves on, not at the end of the raid', () => {
    const { data, run } = scenario({
      rooms: [{ x: 4, y: 4, spawns: [{ monsterId: 'rat', elite: false }] }],
    });
    const prep = { ...run, phase: 'Prep' as const };
    const { run: resolved, result } = playRaid(data, prep);
    expect(result.xpGained).toBeGreaterThan(0);
    expect(resolved.lastRaid?.xpGained).toBe(result.xpGained);
    expect(resolved.level).toBe(1);
    expect(resolved.xp).toBe(0);
    const next = continueRun(data, resolved);
    expect(next.xp).toBe(result.xpGained);
    expect(next.level).toBe(1);
  });

  it('levels up when a raid carries the hero over the threshold, and a save keeps the progress', () => {
    const { data, run } = scenario({
      rooms: [{ x: 4, y: 4, spawns: [{ monsterId: 'rat', elite: false }] }],
    });
    const started = startRaid({ ...run, phase: 'Prep', xp: xpPerLevel - 5 });
    const result = simulateRaid(data, started);
    expect(result.xpGained).toBe(xpPerKill);
    const state = continueRun(data, resolveRaid(started, result));
    expect(state.level).toBe(2);
    expect(state.xp).toBe(xpPerKill - 5);
    const restored = deserializeRun(serializeRun(state));
    expect(restored.level).toBe(2);
    expect(restored.xp).toBe(state.xp);
  });

  it('refuses a save from before the experience system (version 3)', () => {
    const run = createRun(testData, 3, 'warrior');
    const old = JSON.parse(serializeRun(run)) as Record<string, unknown>;
    old['saveVersion'] = 3;
    expect(() => deserializeRun(JSON.stringify(old))).toThrow(RunParseError);
  });
});
