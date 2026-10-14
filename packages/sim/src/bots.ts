import type { GameData } from '@loch/data';
import { activeEffects, computeHeroStatsFor } from './artifacts';
import type { RaidResult } from './combat/types';
import { legalPlacements, placeTile } from './dungeon';
import { continueRun, discardUnplaceableTile, playRaid } from './flow';
import { equip, mergeArtifacts, backpackStacks, unequip } from './inventory';
import { createRng, type Rng } from './rng';
import { createRun } from './run';
import { chooseTile } from './tiles';
import { assignUpgrade } from './upgrades';
import { EQUIP_SLOTS, type ArtifactInstance, type RunState } from './types';

export type BotKind = 'random' | 'greedy-atk' | 'greedy-hp';

export interface RaidReport {
  /** Dungeon level the raid was played at. */
  level: number;
  result: RaidResult;
}

export interface BotRunResult {
  outcome: 'Victory' | 'GameOver' | 'Stuck';
  run: RunState;
  raids: RaidReport[];
}

export interface BotOptions {
  /** Keep the event log of every raid (off for balance runs). */
  recordLog?: boolean;
  /** Safety cap on raids per run. */
  maxRaids?: number;
}

/** Rough value of a stat block + effects for a goal; only used to rank equipment choices. */
function objective(
  data: GameData,
  classId: string,
  equipped: readonly (ArtifactInstance | null)[],
  kind: 'greedy-atk' | 'greedy-hp',
): number {
  const stats = computeHeroStatsFor(data, classId, equipped);
  const fx = activeEffects(data, equipped);
  const sum = (type: string, f: (e: (typeof fx)[number]) => number): number =>
    fx.filter((e) => e.type === type).reduce((a, e) => a + f(e), 0);
  const dps = stats.atk * stats.aspd * (1 + stats.critChance * (stats.critMult - 1));
  const ehp = stats.maxHp * (1 + stats.def / 100);
  if (kind === 'greedy-atk') {
    const bonus =
      sum('everyNthAttack', (e) => e.value / (e.n ?? 5)) +
      sum('executeBonus', (e) => e.value * 0.25) +
      sum('firstStrike', (e) => e.value * 0.05);
    return dps * (1 + bonus) * (1 + sum('lifesteal', (e) => e.value) * 0.5) + ehp * 0.02;
  }
  return (
    ehp * (1 + sum('lifesteal', (e) => e.value) * 2 + sum('reflect', (e) => e.value)) + dps * 0.5
  );
}

function mergeAll(data: GameData, run: RunState, rng: Rng, always: boolean): RunState {
  let cur = run;
  for (;;) {
    const stack = backpackStacks(cur).find((s) => s.mergeable);
    if (!stack || (!always && !rng.chance(0.5))) return cur;
    cur = mergeArtifacts(data, cur, stack.artifactId, stack.level);
  }
}

/** Re-equips the best artifacts by greedy forward selection on the bot's objective. */
function equipGreedy(data: GameData, run: RunState, kind: 'greedy-atk' | 'greedy-hp'): RunState {
  let cur = run;
  for (let slot = 0; slot < EQUIP_SLOTS; slot++) {
    if (cur.equipped[slot]) cur = unequip(cur, slot);
  }
  const chosen: ArtifactInstance[] = [];
  const pool = [...cur.backpack];
  while (chosen.length < EQUIP_SLOTS && pool.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    pool.forEach((cand, i) => {
      const score = objective(data, cur.classId, [...chosen, cand], kind);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    const [pick] = pool.splice(bestIdx, 1);
    if (pick) chosen.push(pick);
  }
  chosen.forEach((inst, i) => {
    cur = equip(cur, inst.uid, i);
  });
  return cur;
}

function equipRandom(run: RunState, rng: Rng): RunState {
  let cur = run;
  for (let slot = 0; slot < EQUIP_SLOTS; slot++) {
    if (cur.equipped[slot] || cur.backpack.length === 0) continue;
    cur = equip(cur, rng.pick(cur.backpack).uid, slot);
  }
  return cur;
}

function prepare(data: GameData, run: RunState, kind: BotKind, rng: Rng): RunState {
  let cur = run;
  const tile = cur.hand[0];
  if (tile) {
    const spots = legalPlacements(data, cur.dungeon, tile);
    cur =
      spots.length > 0
        ? placeTile(data, cur, tile.uid, rng.pick(spots))
        : discardUnplaceableTile(data, cur);
  }
  cur = mergeAll(data, cur, rng, kind !== 'random');
  cur = kind === 'random' ? equipRandom(cur, rng) : equipGreedy(data, cur, kind);
  // Upgrades go to random rooms.
  const roomKeys = Object.keys(cur.dungeon.rooms);
  const count = cur.upgradeStorage.length;
  for (let i = 0; i < count; i++) {
    const upgrade = cur.upgradeStorage[0];
    if (!upgrade) break;
    cur = assignUpgrade(data, cur, rng.pick(roomKeys), upgrade);
  }
  return cur;
}

/** Plays a whole run without any manual input, through every phase of the state machine. */
export function playRun(
  data: GameData,
  seed: number,
  classId: string,
  bot: BotKind,
  options: BotOptions = {},
): BotRunResult {
  const rng = createRng(seed).fork('bot', bot);
  const maxRaids = options.maxRaids ?? 60;
  let run = createRun(data, seed, classId);
  const raids: RaidReport[] = [];
  for (let guard = 0; guard < maxRaids * 4; guard++) {
    switch (run.phase) {
      case 'TileOffer':
      case 'BossOffer':
        run = chooseTile(run, rng.pick(run.tileOffer).uid);
        break;
      case 'Prep': {
        if (raids.length >= maxRaids) return { outcome: 'Stuck', run, raids };
        run = prepare(data, run, bot, rng);
        const level = run.wavesWon + 1;
        const played = playRaid(data, run, { recordLog: options.recordLog ?? false });
        raids.push({ level, result: played.result });
        run = played.run;
        break;
      }
      case 'Resolve':
        run = continueRun(data, run);
        break;
      case 'Victory':
        return { outcome: 'Victory', run, raids };
      case 'GameOver':
        return { outcome: 'GameOver', run, raids };
      default:
        return { outcome: 'Stuck', run, raids };
    }
  }
  return { outcome: 'Stuck', run, raids };
}
