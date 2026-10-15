import { describe, expect, it } from 'vitest';
import type { GameData, RoomLayoutDef } from '@loch/data';
import { simulateRaid } from './combat/raid';
import type { RaidEvent } from './combat/types';
import { blockedCells, layoutFits, pickLayoutId } from './layouts';
import { createRng } from './rng';
import { createRun } from './run';
import { generateBossOffer, generateTileOffer } from './tiles';
import { cloneData, scenario, testData } from './testing';

const layout = (over: Partial<RoomLayoutDef> & { id: string }): RoomLayoutDef => ({
  name: over.id,
  roomTypeId: 'chamber',
  doors: null,
  floors: [],
  props: [],
  blocked: [],
  ...over,
});

const withLayouts = (layouts: RoomLayoutDef[]): GameData =>
  cloneData((d) => {
    d.roomLayouts = Object.fromEntries(layouts.map((l) => [l.id, l]));
  });

const events = <T extends RaidEvent['type']>(log: RaidEvent[], type: T) =>
  log.filter((e): e is Extract<RaidEvent, { type: T }> => e.type === type);

describe('layout choice', () => {
  const data = withLayouts([
    layout({ id: 'chamber_normal_a' }),
    layout({ id: 'chamber_normal_b' }),
    layout({ id: 'chamber_we', doors: ['W', 'E'] }),
    layout({ id: 'elite_normal', roomTypeId: 'elite_room' }),
  ]);

  it('a normal layout fits any doors, a specific one only exactly its doors', () => {
    const [normal, , specific] = Object.values(data.roomLayouts);
    if (!normal || !specific) throw new Error('missing layouts');
    expect(layoutFits(normal, 'chamber', ['N', 'S'])).toBe(true);
    expect(layoutFits(normal, 'elite_room', ['N', 'S'])).toBe(false);
    expect(layoutFits(specific, 'chamber', ['E', 'W'])).toBe(true);
    expect(layoutFits(specific, 'chamber', ['W'])).toBe(false);
    expect(layoutFits(specific, 'chamber', ['W', 'N'])).toBe(false);
  });

  it('picks randomly among the normal layouts and the ones for exactly these doors', () => {
    const seen: Record<string, number> = {};
    for (let seed = 0; seed < 600; seed++) {
      const id = pickLayoutId(data, createRng(seed), 'chamber', ['W', 'E']);
      seen[id ?? 'none'] = (seen[id ?? 'none'] ?? 0) + 1;
    }
    expect(Object.keys(seen).sort()).toEqual([
      'chamber_normal_a',
      'chamber_normal_b',
      'chamber_we',
    ]);
    for (const n of Object.values(seen)) expect(n).toBeGreaterThan(140);
    // Other doors never get the specific layout.
    for (let seed = 0; seed < 100; seed++) {
      expect(pickLayoutId(data, createRng(seed), 'chamber', ['N', 'E'])).not.toBe('chamber_we');
    }
  });

  it('returns nothing for a room type without layouts', () => {
    expect(pickLayoutId(data, createRng(1), 'chest', ['W', 'E'])).toBeUndefined();
    expect(pickLayoutId(testData, createRng(1), 'chamber', ['W', 'E'])).toBeUndefined();
  });

  it('tiles get a layout when they are made, the same one for the same seed', () => {
    const a = generateTileOffer(data, createRun(data, 42, 'warrior')).tileOffer;
    const b = generateTileOffer(data, createRun(data, 42, 'warrior')).tileOffer;
    expect(a.map((t) => t.layoutId)).toEqual(b.map((t) => t.layoutId));
    for (const tile of a) {
      const fitting = Object.values(data.roomLayouts).filter((l) =>
        layoutFits(l, tile.roomTypeId, tile.doors),
      );
      if (fitting.length === 0) expect(tile.layoutId).toBeUndefined();
      else expect(fitting.map((l) => l.id)).toContain(tile.layoutId);
    }
  });

  it('the start room and the boss tile pick layouts for their own doors', () => {
    const custom = withLayouts([
      layout({ id: 'start_only', doors: ['E'] }),
      layout({ id: 'boss_w', roomTypeId: 'boss_room', doors: ['W'] }),
    ]);
    const run = createRun(custom, 5, 'warrior');
    expect(run.dungeon.rooms[run.dungeon.startKey]?.layoutId).toBe('start_only');
    const boss = generateBossOffer(custom, { ...run, phase: 'BossOffer' }).tileOffer[0];
    expect(boss?.layoutId).toBe('boss_w');
  });
});

describe('props block movement', () => {
  /** A wall of props across the middle column, leaving only the top and bottom rows open. */
  const wall = (): [number, number][] => [1, 2, 3, 4, 5].map((y) => [4, y] as [number, number]);

  it('blockedCells lists the cells of the room layout', () => {
    const data = withLayouts([
      layout({
        id: 'blocked',
        blocked: [
          [2, 2],
          [5, 4],
        ],
      }),
    ]);
    expect(blockedCells(data, 'blocked')).toEqual({ '2,2': true, '5,4': true });
    expect(blockedCells(data, undefined)).toEqual({});
    expect(blockedCells(data, 'missing')).toEqual({});
  });

  it('the hero and the monsters never step onto or spawn on a blocked cell', () => {
    const data = withLayouts([layout({ id: 'wall', blocked: wall() })]);
    const blocked = new Set(wall().map(([x, y]) => `${x},${y}`));
    for (let seed = 1; seed <= 15; seed++) {
      const { run } = scenario({
        data,
        seed,
        rooms: [
          {
            x: 4,
            y: 4,
            spawns: [
              { monsterId: 'rat', elite: false },
              { monsterId: 'skeleton', elite: false },
              { monsterId: 'rat', elite: false },
            ],
          },
        ],
      });
      const room = run.dungeon.rooms['4,4'];
      if (!room) throw new Error('no room');
      const withLayout = {
        ...run,
        dungeon: { ...run.dungeon, rooms: { '4,4': { ...room, layoutId: 'wall' } } },
      };
      const log = simulateRaid(data, withLayout).log;
      const enter = events(log, 'RoomEnter')[0];
      expect(enter?.layoutId).toBe('wall');
      for (const e of events(log, 'Spawn')) expect(blocked.has(`${e.x},${e.y}`)).toBe(false);
      for (const e of events(log, 'Move')) expect(blocked.has(`${e.to.x},${e.to.y}`)).toBe(false);
    }
  });

  it('the walk to a chest goes around props', () => {
    const data = withLayouts([
      layout({ id: 'chest_blocked', roomTypeId: 'chest', blocked: [[4, 3]] }),
    ]);
    // The cell in front of the chest is blocked in this (invalid) layout: the hero still never
    // enters it, he stops as close as he can and opens the chest from there.
    const { run } = scenario({ data, rooms: [{ x: 4, y: 4, roomTypeId: 'chest' }] });
    const room = run.dungeon.rooms['4,4'];
    if (!room) throw new Error('no room');
    const withLayout = {
      ...run,
      dungeon: { ...run.dungeon, rooms: { '4,4': { ...room, layoutId: 'chest_blocked' } } },
    };
    const result = simulateRaid(data, withLayout);
    expect(result.won).toBe(true);
    expect(events(result.log, 'Move').some((m) => m.to.x === 4 && m.to.y === 3)).toBe(false);
    expect(events(result.log, 'ChestOpen')).toHaveLength(1);
  });

  it('rooms without a layout behave exactly as before', () => {
    const a = scenario({ seed: 3 });
    const log = simulateRaid(a.data, a.run).log;
    expect(events(log, 'RoomEnter')[0]?.layoutId).toBeNull();
  });
});
