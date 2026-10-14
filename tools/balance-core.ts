import type { GameData } from '@loch/data';
import { playRun, type BotKind } from '@loch/sim';

/** Raw numbers of one batch of runs (small enough to move between threads). */
export interface BatchStats {
  bot: BotKind;
  runs: number;
  /** Per class id. */
  byClass: Record<string, { runs: number; wins: number }>;
  stuck: number;
  timeouts: number;
  raids: number;
  merges: number;
  artifacts: number;
  /** Raids and losses per dungeon level (index = level). */
  raidsByLevel: number[];
  lossesByLevel: number[];
  /** Raid durations in ticks, per dungeon level. */
  ticksByLevel: number[][];
  /** Total simulated ticks of each run (for the run length estimate). */
  runTicks: number[];
  /** Who killed the hero, by monster id. */
  killers: Record<string, number>;
}

export function emptyStats(bot: BotKind): BatchStats {
  return {
    bot,
    runs: 0,
    byClass: {},
    stuck: 0,
    timeouts: 0,
    raids: 0,
    merges: 0,
    artifacts: 0,
    raidsByLevel: Array.from({ length: 12 }, () => 0),
    lossesByLevel: Array.from({ length: 12 }, () => 0),
    ticksByLevel: Array.from({ length: 12 }, () => []),
    runTicks: [],
    killers: {},
  };
}

/** Plays `count` runs starting at `firstSeed`; classes rotate so every class gets equal samples. */
export function runBatch(
  data: GameData,
  bot: BotKind,
  firstSeed: number,
  count: number,
): BatchStats {
  const stats = emptyStats(bot);
  const classes = Object.keys(data.classes);
  for (let i = 0; i < count; i++) {
    const seed = firstSeed + i;
    const classId = classes[seed % classes.length] ?? 'warrior';
    const out = playRun(data, seed, classId, bot, { recordLog: false });
    const c = (stats.byClass[classId] ??= { runs: 0, wins: 0 });
    c.runs++;
    stats.runs++;
    if (out.outcome === 'Victory') c.wins++;
    if (out.outcome === 'Stuck') stats.stuck++;
    stats.merges += out.run.stats.merges;
    stats.artifacts += out.run.stats.artifactsFound;
    let runTicks = 0;
    for (const raid of out.raids) {
      const level = Math.min(11, Math.max(1, raid.level));
      stats.raids++;
      stats.raidsByLevel[level] = (stats.raidsByLevel[level] ?? 0) + 1;
      stats.ticksByLevel[level]?.push(raid.result.ticks);
      runTicks += raid.result.ticks;
      if (raid.result.reason === 'timeout') stats.timeouts++;
      if (!raid.result.won) {
        stats.lossesByLevel[level] = (stats.lossesByLevel[level] ?? 0) + 1;
        const killer = raid.result.death?.killerMonsterId ?? raid.result.reason;
        stats.killers[killer] = (stats.killers[killer] ?? 0) + 1;
      }
    }
    stats.runTicks.push(runTicks);
  }
  return stats;
}

export function mergeStats(parts: BatchStats[]): BatchStats {
  const first = parts[0];
  if (!first) throw new Error('nothing to merge');
  const out = emptyStats(first.bot);
  for (const p of parts) {
    out.runs += p.runs;
    out.stuck += p.stuck;
    out.timeouts += p.timeouts;
    out.raids += p.raids;
    out.merges += p.merges;
    out.artifacts += p.artifacts;
    for (const [k, v] of Object.entries(p.byClass)) {
      const c = (out.byClass[k] ??= { runs: 0, wins: 0 });
      c.runs += v.runs;
      c.wins += v.wins;
    }
    for (let l = 0; l < 12; l++) {
      out.raidsByLevel[l] = (out.raidsByLevel[l] ?? 0) + (p.raidsByLevel[l] ?? 0);
      out.lossesByLevel[l] = (out.lossesByLevel[l] ?? 0) + (p.lossesByLevel[l] ?? 0);
      out.ticksByLevel[l]?.push(...(p.ticksByLevel[l] ?? []));
    }
    out.runTicks.push(...p.runTicks);
    for (const [k, v] of Object.entries(p.killers)) out.killers[k] = (out.killers[k] ?? 0) + v;
  }
  return out;
}

export const median = (xs: readonly number[]): number => {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0) : ((s[mid - 1] ?? 0) + (s[mid] ?? 0)) / 2;
};

const pct = (n: number, d: number): string => (d === 0 ? '-' : `${((100 * n) / d).toFixed(1)}%`);

/** Markdown report for one bot (all classes pooled and per class). */
export function reportBot(s: BatchStats, tickRate = 20, prepSeconds = 45): string {
  const wins = Object.values(s.byClass).reduce((a, c) => a + c.wins, 0);
  const lines: string[] = [];
  lines.push(`### Bot \`${s.bot}\`: ${s.runs} runów, wygrane ${pct(wins, s.runs)}`);
  const rates = Object.entries(s.byClass).map(([k, c]) => ({
    k,
    rate: (100 * c.wins) / c.runs,
    c,
  }));
  const spread = rates.length
    ? Math.max(...rates.map((r) => r.rate)) - Math.min(...rates.map((r) => r.rate))
    : 0;
  lines.push('');
  lines.push('| Klasa | Runy | Wygrane |');
  lines.push('|---|---|---|');
  for (const r of rates) lines.push(`| ${r.k} | ${r.c.runs} | ${r.rate.toFixed(1)}% |`);
  lines.push('');
  lines.push(`Rozrzut między klasami: ${spread.toFixed(1)} pkt proc.`);
  lines.push('');
  lines.push('| Poziom lochu | Rajdy | Porażki | % porażek | Mediana rajdu [s] |');
  lines.push('|---|---|---|---|---|');
  for (let l = 1; l <= 11; l++) {
    const med = median(s.ticksByLevel[l] ?? []) / tickRate;
    lines.push(
      `| ${l} | ${s.raidsByLevel[l]} | ${s.lossesByLevel[l]} | ${pct(s.lossesByLevel[l] ?? 0, s.raidsByLevel[l] ?? 0)} | ${med.toFixed(1)} |`,
    );
  }
  const high = Array.from({ length: 8 }, (_, i) => s.ticksByLevel[i + 4] ?? []).flat();
  const low = [1, 2, 3].flatMap((l) => s.ticksByLevel[l] ?? []);
  const raidsPerRun = s.raids / Math.max(1, s.runs);
  const runMinutes = median(s.runTicks.map((t) => t / tickRate + prepSeconds * raidsPerRun)) / 60;
  lines.push('');
  lines.push(
    `Mediana rajdu na poz. ≥ 4: **${(median(high) / tickRate).toFixed(1)} s**, na poz. 1–3: ${(median(low) / tickRate).toFixed(1)} s. ` +
      `Mediana długości runu (rajdy 1× + ${prepSeconds} s Prep na rajd): **${runMinutes.toFixed(1)} min**.`,
  );
  lines.push(
    `Na run: rajdów ${raidsPerRun.toFixed(1)}, scaleń ${(s.merges / s.runs).toFixed(1)}, artefaktów ${(s.artifacts / s.runs).toFixed(1)}. ` +
      `Timeouty: **${s.timeouts}**, utknięte runy: ${s.stuck}.`,
  );
  const killers = Object.entries(s.killers)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  lines.push(`Przyczyny porażek: ${killers || '-'}.`);
  return lines.join('\n');
}

export function winRate(s: BatchStats): number {
  const wins = Object.values(s.byClass).reduce((a, c) => a + c.wins, 0);
  return s.runs === 0 ? 0 : (100 * wins) / s.runs;
}
