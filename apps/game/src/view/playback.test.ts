import { describe, expect, it } from 'vitest';
import { loadGameData } from '@loch/data';
import { randomRaidReadyRun, simulateRaid } from '@loch/sim';
import { RaidPlayback } from './playback';

const data = loadGameData();
const raid = (seed: number) => simulateRaid(data, randomRaidReadyRun(data, seed, 'warrior', 3, 3));

describe('RaidPlayback', () => {
  it('skipping to the end reproduces the simulated outcome', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const r = raid(seed);
      const p = new RaidPlayback(r.log);
      p.skipToEnd();
      const s = p.snapshot();
      expect(s.ended).toBe(true);
      expect(s.won).toBe(r.won);
      expect(s.reason).toBe(r.reason);
      const hero = s.units.find((u) => u.id === 0);
      if (r.won) expect(hero?.hp).toBeCloseTo(r.heroHp, 5);
      else expect(hero).toBeUndefined(); // the dead hero is removed
    }
  });

  it('advances event by event and interpolates movement', () => {
    const r = raid(2);
    const p = new RaidPlayback(r.log);
    const firstMove = r.log.find((e) => e.type === 'Move');
    if (firstMove?.type !== 'Move') throw new Error('no move');
    p.advanceTo(firstMove.tick);
    const mid = p.snapshot().units.find((u) => u.id === firstMove.unit);
    expect(mid?.x).toBeCloseTo(firstMove.from.x, 5);
    p.advanceTo(firstMove.tick + firstMove.duration / 2);
    const half = p.snapshot().units.find((u) => u.id === firstMove.unit);
    expect(half?.x).toBeCloseTo((firstMove.from.x + firstMove.to.x) / 2, 5);
    expect(half?.y).toBeCloseTo((firstMove.from.y + firstMove.to.y) / 2, 5);
  });

  it('applies events only up to the current tick', () => {
    const r = raid(3);
    const p = new RaidPlayback(r.log);
    p.advanceTo(0);
    expect(p.done).toBe(false);
    expect(p.snapshot().units.every((u) => u.hp === u.maxHp)).toBe(true);
    p.skipToEnd();
    expect(p.done).toBe(true);
  });

  it('clears monsters when a new room starts', () => {
    const r = raid(4);
    const p = new RaidPlayback(r.log);
    const enters = r.log.filter((e) => e.type === 'RoomEnter');
    const second = enters[1];
    if (second?.type !== 'RoomEnter') return;
    p.advanceTo(second.tick);
    const monsterIds = new Set(
      p
        .snapshot()
        .units.filter((u) => u.id !== 0)
        .map((u) => u.id),
    );
    const spawnsAfter = r.log.filter((e) => e.type === 'Spawn' && e.tick >= second.tick);
    for (const id of monsterIds) {
      expect(spawnsAfter.some((s) => s.type === 'Spawn' && s.unit === id)).toBe(true);
    }
  });
});
