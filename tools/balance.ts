// Headless balance runner.
// Usage: pnpm balance -- --runs 10000 --bot greedy-atk [--bot all] [--threads 8] [--seed 1]
//                        [--label "iter 1"] [--append docs/BALANCE.md]
import { appendFileSync } from 'node:fs';
import os from 'node:os';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { loadGameData } from '@loch/data';
import type { BotKind } from '@loch/sim';
import { mergeStats, reportBot, runBatch, winRate, type BatchStats } from './balance-core';

const BOTS: BotKind[] = ['random', 'greedy-atk', 'greedy-hp'];

interface Job {
  bot: BotKind;
  firstSeed: number;
  count: number;
}

if (!isMainThread) {
  const job = workerData as Job;
  parentPort?.postMessage(runBatch(loadGameData(), job.bot, job.firstSeed, job.count));
} else {
  void main();
}

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  const v = i >= 0 ? process.argv[i + 1] : undefined;
  return v !== undefined && !v.startsWith('--') ? v : fallback;
}

function runJob(job: Job): Promise<BatchStats> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL(import.meta.url), { workerData: job });
    worker.once('message', resolve);
    worker.once('error', reject);
  });
}

async function main(): Promise<void> {
  const runs = Number(arg('runs', '10000'));
  const botArg = arg('bot', 'all');
  const bots = botArg === 'all' ? BOTS : [botArg as BotKind];
  const threads = Math.max(1, Number(arg('threads', String(Math.max(1, os.cpus().length - 1)))));
  const seed0 = Number(arg('seed', '1'));
  const label = arg('label', '');
  const append = arg('append', '');
  const started = Date.now();
  const sections: string[] = [];
  const summary: string[] = [];

  for (const bot of bots) {
    const chunk = Math.ceil(runs / threads);
    const jobs: Job[] = [];
    for (let first = 0; first < runs; first += chunk) {
      jobs.push({ bot, firstSeed: seed0 + first, count: Math.min(chunk, runs - first) });
    }
    const stats = mergeStats(await Promise.all(jobs.map(runJob)));
    sections.push(reportBot(stats));
    summary.push(`${bot}: ${winRate(stats).toFixed(1)}%`);
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  const header = `## ${label || 'Raport balansu'} (${runs} runów na bota, ziarna od ${seed0}, ${elapsed} s)`;
  const text = `${header}\n\nPodsumowanie: ${summary.join(', ')}\n\n${sections.join('\n\n')}\n`;
  console.log(text);
  if (append) appendFileSync(append, `\n${text}`);
}
