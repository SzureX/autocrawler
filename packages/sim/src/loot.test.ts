import { describe, expect, it } from 'vitest';
import type { Rarity } from '@loch/data';
import { planRaid } from './combat/plan';
import { hashRaidLog, simulateRaid } from './combat/raid';
import { computeRaidRoute } from './route';
import type { RaidEvent } from './combat/types';
import { planDrops, rollArtifact, rollRarity, sampleWithoutReplacement } from './loot';
import { createRng } from './rng';
import { applyRaidLoot, assignUpgrade, removeUpgrade } from './upgrades';
import { cloneData, scenario, testData } from './testing';
import type { SpawnSpec } from './types';

const rat: SpawnSpec = { monsterId: 'rat', elite: false };
const skeleton: SpawnSpec = { monsterId: 'skeleton', elite: false };
const brute: SpawnSpec = { monsterId: 'brute', elite: false };

const lootEvents = (log: readonly RaidEvent[]) =>
  log.filter((e): e is Extract<RaidEvent, { type: 'LootDropped' }> => e.type === 'LootDropped');

describe('rarity and artifact rolls', () => {
  const share = (level: number, n = 20000): Record<Rarity, number> => {
    const rng = createRng(level * 31);
    const counts: Record<Rarity, number> = { common: 0, rare: 0, epic: 0 };
    for (let i = 0; i < n; i++) counts[rollRarity(testData, rng, level)]++;
    return { common: counts.common / n, rare: counts.rare / n, epic: counts.epic / n };
  };

  it('follows the level weights 80/18/2, 60/32/8 and 40/42/18', () => {
    const early = share(2);
    expect(early.common).toBeCloseTo(0.8, 1);
    expect(early.rare).toBeCloseTo(0.18, 1);
    expect(early.epic).toBeGreaterThan(0.005);
    expect(early.epic).toBeLessThan(0.04);
    const mid = share(5);
    expect(mid.common).toBeCloseTo(0.6, 1);
    expect(mid.rare).toBeCloseTo(0.32, 1);
    expect(mid.epic).toBeCloseTo(0.08, 1);
    const late = share(9);
    expect(late.common).toBeCloseTo(0.4, 1);
    expect(late.rare).toBeCloseTo(0.42, 1);
    expect(late.epic).toBeCloseTo(0.18, 1);
  });

  it('later levels give better loot than earlier ones', () => {
    expect(share(9).epic).toBeGreaterThan(share(5).epic);
    expect(share(5).epic).toBeGreaterThan(share(1).epic);
  });

  it('minRarity excludes lower rarities and renormalizes', () => {
    const rng = createRng(3);
    for (let i = 0; i < 500; i++) {
      expect(rollRarity(testData, rng, 1, 'rare')).not.toBe('common');
      expect(rollRarity(testData, rng, 1, 'epic')).toBe('epic');
    }
  });

  it('picks only artifacts of the rolled rarity, weighted by dropWeight', () => {
    const rng = createRng(4);
    for (let i = 0; i < 200; i++) {
      const id = rollArtifact(testData, rng, 7, 'epic');
      expect(testData.artifacts[id]?.rarity).toBe('epic');
    }
    const heavy = cloneData((d) => {
      const helm = d.artifacts['iron_helm'];
      if (helm) helm.dropWeight = 1000;
    });
    const r2 = createRng(5);
    let helms = 0;
    for (let i = 0; i < 400; i++) {
      if (rollArtifact(heavy, r2, 1) === 'iron_helm') helms++;
    }
    expect(helms).toBeGreaterThan(200);
  });
});

describe('planDrops', () => {
  it('drops 4-6 artifacts and 1-2 upgrades, at most one artifact per monster', () => {
    const counts = new Set<number>();
    const upgrades = new Set<number>();
    for (let seed = 0; seed < 300; seed++) {
      const plan = planDrops(
        testData,
        createRng(seed),
        5,
        Array.from({ length: 10 }, () => 1),
      );
      const art = plan.flatMap((d) => d.filter((x) => x.kind === 'artifact'));
      const upg = plan.flatMap((d) => d.filter((x) => x.kind === 'upgrade'));
      counts.add(art.length);
      upgrades.add(upg.length);
      for (const d of plan) {
        expect(d.filter((x) => x.kind === 'artifact').length).toBeLessThanOrEqual(1);
        expect(d.filter((x) => x.kind === 'upgrade').length).toBeLessThanOrEqual(1);
      }
    }
    expect([...counts].sort()).toEqual([4, 5, 6]);
    expect([...upgrades].sort()).toEqual([1, 2]);
  });

  it('is capped by the number of monsters and handles an empty dungeon', () => {
    for (let seed = 0; seed < 50; seed++) {
      const plan = planDrops(testData, createRng(seed), 1, [1, 1]);
      expect(plan.flatMap((d) => d.filter((x) => x.kind === 'artifact')).length).toBe(2);
      expect(plan.flatMap((d) => d.filter((x) => x.kind === 'upgrade')).length).toBeLessThanOrEqual(
        2,
      );
    }
    expect(planDrops(testData, createRng(1), 1, [])).toEqual([]);
  });

  it('elites (weight 3) carry drops about three times as often', () => {
    let elite = 0;
    let normal = 0;
    for (let seed = 0; seed < 4000; seed++) {
      // 1 elite + 5 normal monsters, one artifact drop is rolled 4-6 times among them.
      const plan = planDrops(testData, createRng(seed), 1, [3, 1, 1, 1, 1, 1]);
      if (plan[0]?.some((d) => d.kind === 'artifact')) elite++;
      if (plan[1]?.some((d) => d.kind === 'artifact')) normal++;
    }
    expect(elite).toBeGreaterThan(normal);
    expect(elite / 4000).toBeGreaterThan(0.85);
  });

  it('sampling without replacement returns distinct indices and skips zero weights', () => {
    for (let seed = 0; seed < 100; seed++) {
      const picked = sampleWithoutReplacement(createRng(seed), [1, 0, 2, 1], 3);
      expect(new Set(picked).size).toBe(picked.length);
      expect(picked).not.toContain(1);
    }
  });
});

describe('loot in a raid', () => {
  const strong = (): ReturnType<typeof cloneData> =>
    cloneData((d) => {
      const w = d.classes['warrior'];
      if (w) {
        w.stats.atk = 80;
        w.stats.maxHp = 3000;
      }
    });

  it('a won raid collects every planned drop into the result', () => {
    const { data, run } = scenario({
      data: strong(),
      seed: 12,
      rooms: [{ x: 4, y: 4, spawns: [rat, rat, skeleton, skeleton, rat, rat] }],
    });
    const r = simulateRaid(data, run);
    expect(r.won).toBe(true);
    expect(r.lootArtifacts.length).toBeGreaterThanOrEqual(4);
    expect(r.lootArtifacts.length).toBeLessThanOrEqual(6);
    expect(r.lootUpgrades.length).toBeGreaterThanOrEqual(1);
    expect(r.lootUpgrades.length).toBeLessThanOrEqual(2);
    // Every loot event is in the result and vice versa.
    const events = lootEvents(r.log);
    expect(events.filter((e) => e.item.kind === 'artifact')).toHaveLength(r.lootArtifacts.length);
    expect(events.filter((e) => e.item.kind === 'upgrade')).toHaveLength(r.lootUpgrades.length);
    // Artifact uids continue the run counter and are unique.
    const uids = r.lootArtifacts.map((a) => a.uid);
    expect(new Set(uids).size).toBe(uids.length);
    expect(uids[0]).toBe(`art-${run.nextUid}`);
    // Drops come from monster deaths.
    for (const e of events) expect(e.unit).not.toBeNull();
  });

  it('monsters drop on death, in the tick they die', () => {
    const { data, run } = scenario({
      data: strong(),
      seed: 3,
      rooms: [{ x: 4, y: 4, spawns: [rat, rat, rat, rat, rat] }],
    });
    const log = simulateRaid(data, run).log;
    const deaths: Record<number, number> = {};
    for (const e of log) if (e.type === 'Death') deaths[e.unit] = e.tick;
    for (const e of lootEvents(log)) {
      if (e.unit !== null) expect(e.tick).toBe(deaths[e.unit]);
    }
  });

  it('drops of monsters that were never killed are lost when the hero dies', () => {
    // A fragile hero fights a big room: the plan carries drops for all monsters.
    let someLost = false;
    for (let seed = 1; seed <= 30; seed++) {
      const { data, run } = scenario({
        data: cloneData((d) => {
          const w = d.classes['warrior'];
          if (w) w.stats.maxHp = 60;
        }),
        seed,
        rooms: [{ x: 4, y: 4, spawns: [skeleton, skeleton, skeleton, brute, brute, rat] }],
      });
      const r = simulateRaid(data, run);
      if (r.won) continue;
      expect(r.reason).toBe('died');
      const killed = r.kills;
      expect(r.lootArtifacts.length).toBeLessThanOrEqual(killed);
      someLost = true;
    }
    expect(someLost).toBe(true);
  });

  it('the boss drops nothing', () => {
    const { data, run } = scenario({
      data: cloneData((d) => {
        const w = d.classes['warrior'];
        if (w) {
          w.stats.atk = 400;
          w.stats.maxHp = 9000;
        }
      }),
      wavesWon: 10,
      rooms: [
        { x: 4, y: 4, doors: ['E'], spawns: [] },
        { x: 5, y: 4, doors: ['W'], bossId: 'warden' },
      ],
    });
    const r = simulateRaid(data, run);
    expect(r.won).toBe(true);
    expect(r.lootArtifacts).toEqual([]);
    expect(r.lootUpgrades).toEqual([]);
  });

  it('drop weights: elite (x3) and blood altar (+50%) shift where loot sits', () => {
    // Two rooms with 8 monsters each: the first has a higher weight per monster.
    const carriers = (first: { roomTypeId?: string; upgradeId?: string; elite?: boolean }) => {
      let inFirst = 0;
      let inSecond = 0;
      for (let seed = 1; seed <= 300; seed++) {
        const monsters = (elite: boolean): SpawnSpec[] =>
          Array.from({ length: 8 }, () => ({ monsterId: 'rat', elite }));
        const { data, run } = scenario({
          seed,
          rooms: [
            {
              x: 4,
              y: 4,
              doors: ['E', 'W'],
              roomTypeId: first.roomTypeId ?? 'chamber',
              spawns: monsters(first.elite ?? false),
              ...(first.upgradeId ? { upgradeId: first.upgradeId } : {}),
            },
            { x: 5, y: 4, doors: ['W'], spawns: monsters(false) },
          ],
        });
        const route = computeRaidRoute(run.dungeon);
        const plans = planRaid(data, run, 0, route, 1);
        const count = (key: string): number =>
          (plans[key]?.drops ?? []).filter((d) => d?.some((x) => x.kind === 'artifact')).length;
        inFirst += count('4,4');
        inSecond += count('5,4');
      }
      return inFirst / inSecond;
    };
    expect(carriers({ elite: true })).toBeGreaterThan(1.5);
    expect(carriers({ upgradeId: 'blood_altar' })).toBeGreaterThan(1.1);
    expect(carriers({})).toBeGreaterThan(0.85);
    expect(carriers({})).toBeLessThan(1.15);
  }, 60_000);

  it('is deterministic: same seed -> identical loot', () => {
    const make = () =>
      scenario({
        data: strong(),
        seed: 21,
        rooms: [{ x: 4, y: 4, spawns: [rat, skeleton, rat, skeleton, rat] }],
      });
    const a = make();
    const b = make();
    const ra = simulateRaid(a.data, a.run);
    const rb = simulateRaid(b.data, b.run);
    expect(ra.lootArtifacts).toEqual(rb.lootArtifacts);
    expect(ra.lootUpgrades).toEqual(rb.lootUpgrades);
    expect(hashRaidLog(ra.log)).toBe(hashRaidLog(rb.log));
  });
});

describe('room clear rewards', () => {
  const strongData = (): ReturnType<typeof cloneData> =>
    cloneData((d) => {
      const w = d.classes['warrior'];
      if (w) {
        w.stats.atk = 80;
        w.stats.maxHp = 3000;
      }
    });
  const clearLoot = (r: ReturnType<typeof simulateRaid>) =>
    lootEvents(r.log).filter((e) => e.unit === null);

  it('a chest gives exactly one artifact, taken after the hero opens it', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { data, run } = scenario({
        data: strongData(),
        seed,
        rooms: [{ x: 4, y: 4, roomTypeId: 'chest' }],
      });
      const r = simulateRaid(data, run);
      expect(r.won).toBe(true);
      const items = clearLoot(r);
      expect(items).toHaveLength(1);
      expect(items[0]?.item.kind).toBe('artifact');
      const opened = r.log.find((e) => e.type === 'ChestOpen')?.tick;
      expect(opened).toBeDefined();
      // The artifact appears once the lid has been up for openTicks, right before the room clears.
      expect(items[0]?.tick).toBe((opened ?? 0) + data.balance.combat.chest.openTicks);
      expect(r.lootArtifacts).toHaveLength(1);
    }
  });

  it('the chest artifact follows the dungeon level (rarity weights)', () => {
    const better = (wavesWon: number): number => {
      let count = 0;
      for (let seed = 1; seed <= 400; seed++) {
        const { data, run } = scenario({
          data: strongData(),
          seed,
          wavesWon,
          rooms: [{ x: 4, y: 4, roomTypeId: 'chest' }],
        });
        for (const a of simulateRaid(data, run).lootArtifacts) {
          if (testData.artifacts[a.artifactId]?.rarity !== 'common') count++;
        }
      }
      return count;
    };
    expect(better(8)).toBeGreaterThan(better(0));
  });

  it('an anvil gives a rare-or-better artifact, a guardian gate any artifact (and +25% HP)', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const anvil = scenario({
        data: strongData(),
        seed,
        rooms: [{ x: 4, y: 4, spawns: [rat], upgradeId: 'anvil' }],
      });
      const items = clearLoot(simulateRaid(anvil.data, anvil.run));
      expect(items).toHaveLength(1);
      const first = items[0]?.item;
      if (first?.kind !== 'artifact') throw new Error('expected an artifact');
      expect(testData.artifacts[first.artifact.artifactId]?.rarity).not.toBe('common');
    }
    const gate = scenario({
      data: strongData(),
      seed: 4,
      rooms: [{ x: 4, y: 4, spawns: [skeleton], upgradeId: 'guardian_gate' }],
    });
    const r = simulateRaid(gate.data, gate.run);
    expect(clearLoot(r).filter((e) => e.item.kind === 'artifact')).toHaveLength(1);
    expect(r.log.find((e) => e.type === 'Spawn')).toMatchObject({ maxHp: Math.round(45 * 1.25) });
  });

  it('no clear rewards are given when the hero dies in the room', () => {
    const { data, run } = scenario({
      data: cloneData((d) => {
        const w = d.classes['warrior'];
        if (w) w.stats.maxHp = 5;
      }),
      rooms: [{ x: 4, y: 4, spawns: [brute, brute], upgradeId: 'anvil' }],
    });
    const r = simulateRaid(data, run);
    expect(r.won).toBe(false);
    expect(clearLoot(r)).toEqual([]);
  });

  it('a blood altar adds a monster and raises the drop weight in its room', () => {
    const { data, run } = scenario({
      data: strongData(),
      seed: 2,
      rooms: [{ x: 4, y: 4, spawns: [rat, skeleton], upgradeId: 'blood_altar' }],
    });
    const spawns = simulateRaid(data, run).log.filter((e) => e.type === 'Spawn');
    expect(spawns).toHaveLength(3);
  });

  it('an upgrade changes the raid for the same seed', () => {
    const base = { data: strongData(), seed: 9 };
    const plain = scenario({ ...base, rooms: [{ x: 4, y: 4, spawns: [rat, skeleton] }] });
    const fog = scenario({
      ...base,
      rooms: [{ x: 4, y: 4, spawns: [rat, skeleton], upgradeId: 'fog' }],
    });
    expect(hashRaidLog(simulateRaid(plain.data, plain.run).log)).not.toBe(
      hashRaidLog(simulateRaid(fog.data, fog.run).log),
    );
  });
});

describe('assignUpgrade / removeUpgrade', () => {
  const prep = (storage: string[]) => {
    const { data, run } = scenario({
      rooms: [
        { x: 4, y: 4, doors: ['E'], spawns: [rat] },
        { x: 5, y: 4, doors: ['W'], spawns: [rat] },
      ],
    });
    return { data, run: { ...run, upgradeStorage: storage } };
  };

  it('moves an upgrade from the storage into a room', () => {
    const { data, run } = prep(['fountain', 'fog']);
    const next = assignUpgrade(data, run, '5,4', 'fog');
    expect(next.dungeon.rooms['5,4']?.upgradeId).toBe('fog');
    expect(next.upgradeStorage).toEqual(['fountain']);
  });

  it('replacing an upgrade returns the old one to the storage', () => {
    const { data, run } = prep(['fountain', 'fog']);
    const a = assignUpgrade(data, run, '4,4', 'fog');
    const b = assignUpgrade(data, a, '4,4', 'fountain');
    expect(b.dungeon.rooms['4,4']?.upgradeId).toBe('fountain');
    expect(b.upgradeStorage).toEqual(['fog']);
  });

  it('keeps duplicates as separate pieces', () => {
    const { data, run } = prep(['fog', 'fog']);
    const next = assignUpgrade(data, run, '4,4', 'fog');
    expect(next.upgradeStorage).toEqual(['fog']);
  });

  it('removeUpgrade returns it to the storage', () => {
    const { data, run } = prep(['fog']);
    const a = assignUpgrade(data, run, '4,4', 'fog');
    const b = removeUpgrade(a, '4,4');
    expect(b.dungeon.rooms['4,4']?.upgradeId).toBeNull();
    expect(b.upgradeStorage).toEqual(['fog']);
    expect(() => removeUpgrade(b, '4,4')).toThrow(/no upgrade/);
  });

  it('rejects missing upgrades, rooms and wrong phases', () => {
    const { data, run } = prep(['fog']);
    expect(() => assignUpgrade(data, run, '4,4', 'fountain')).toThrow(/storage/);
    expect(() => assignUpgrade(data, run, '0,0', 'fog')).toThrow(/No room/);
    expect(() => assignUpgrade(data, run, '4,4', 'nope')).toThrow(/Unknown/);
    expect(() => assignUpgrade(data, { ...run, phase: 'Action' }, '4,4', 'fog')).toThrow(/phase/);
    expect(() => removeUpgrade({ ...run, phase: 'Resolve' }, '4,4')).toThrow();
  });
});

describe('applyRaidLoot', () => {
  it('adds artifacts to the backpack, upgrades to the storage and advances the uid counter', () => {
    const { data, run } = scenario({
      data: cloneData((d) => {
        const w = d.classes['warrior'];
        if (w) {
          w.stats.atk = 80;
          w.stats.maxHp = 3000;
        }
      }),
      seed: 17,
      rooms: [{ x: 4, y: 4, spawns: [rat, rat, rat, rat, rat] }],
    });
    const r = simulateRaid(data, run);
    const next = applyRaidLoot(run, r);
    expect(next.backpack).toHaveLength(r.lootArtifacts.length);
    expect(next.upgradeStorage).toEqual(r.lootUpgrades);
    expect(next.nextUid).toBe(run.nextUid + r.lootArtifacts.length);
    expect(next.stats.artifactsFound).toBe(r.lootArtifacts.length);
    expect(new Set(next.backpack.map((a) => a.uid)).size).toBe(next.backpack.length);
  });
});
