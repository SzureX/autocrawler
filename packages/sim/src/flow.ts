import type { GameData } from '@loch/data';
import type { RaidResult } from './combat/types';
import { simulateRaid, type SimulateOptions } from './combat/raid';
import { legalPlacements } from './dungeon';
import { setPhase } from './phases';
import { generateBossOffer, generateTileOffer } from './tiles';
import { applyRaidLoot } from './upgrades';
import type { RaidSummary, RunState } from './types';

export function hasBossRoom(run: Pick<RunState, 'dungeon'>): boolean {
  return Object.values(run.dungeon.rooms).some((r) => r.isBoss);
}

/** Prep -> Action. Building is mandatory: Start is illegal while a tile is still in hand. */
export function startRaid(run: RunState): RunState {
  if (run.phase !== 'Prep') throw new Error(`Cannot start a raid in phase ${run.phase}`);
  if (run.hand.length > 0) throw new Error('Cannot start a raid before the tile in hand is built');
  return setPhase({ ...run, raidAttempts: run.raidAttempts + 1 }, 'Action');
}

/**
 * Action -> Resolve. Loot collected during the raid is kept even after a defeat.
 * A win counts a wave, a defeat costs a life.
 */
export function resolveRaid(run: RunState, result: RaidResult): RunState {
  if (run.phase !== 'Action') throw new Error(`Cannot resolve a raid in phase ${run.phase}`);
  const looted = applyRaidLoot(run, result);
  const summary: RaidSummary = {
    won: result.won,
    reason: result.reason,
    ticks: result.ticks,
    roomsCleared: result.roomsCleared,
    lootArtifacts: result.lootArtifacts,
    lootUpgrades: result.lootUpgrades,
    livesLost: result.won ? 0 : 1,
    killer: result.death?.killerMonsterId ?? null,
  };
  const stats = {
    ...looted.stats,
    raids: looted.stats.raids + 1,
    wins: looted.stats.wins + (result.won ? 1 : 0),
    losses: looted.stats.losses + (result.won ? 0 : 1),
  };
  const next: RunState = {
    ...looted,
    stats,
    lastRaid: summary,
    // The boss raid ends the run, so it does not count as a wave (waves stay 0..10).
    wavesWon: looted.wavesWon + (result.won && !hasBossRoom(looted) ? 1 : 0),
    lives: looted.lives - (result.won ? 0 : 1),
  };
  return setPhase(next, 'Resolve');
}

/**
 * Resolve -> the next phase: Victory (boss defeated), GameOver (no lives),
 * TileOffer (win before the boss), BossOffer (10th win) or Prep (defeat, no tile).
 */
export function continueRun(data: GameData, run: RunState): RunState {
  if (run.phase !== 'Resolve') throw new Error(`Cannot continue in phase ${run.phase}`);
  const raid = run.lastRaid;
  if (!raid) throw new Error('Resolve phase without a raid summary');
  if (!raid.won) {
    return setPhase(run, run.lives <= 0 ? 'GameOver' : 'Prep');
  }
  if (hasBossRoom(run)) return setPhase(run, 'Victory');
  if (run.wavesWon < data.balance.wavesToBoss) {
    return setPhase(generateTileOffer(data, run), 'TileOffer');
  }
  // 10 wins: the boss offer (one card in the prototype); the chosen boss room builds itself.
  return setPhase(generateBossOffer(data, run), 'BossOffer');
}

/**
 * Safety valve: a regular tile that has no legal position (practically impossible, the offer
 * generator guarantees one) is discarded so the run can never soft lock.
 */
export function discardUnplaceableTile(data: GameData, run: RunState): RunState {
  if (run.phase !== 'Prep') throw new Error(`Cannot discard a tile in phase ${run.phase}`);
  const tile = run.hand[0];
  if (!tile) throw new Error('No tile in hand');
  if (tile.isBoss) throw new Error('The boss tile cannot be discarded');
  if (legalPlacements(data, run.dungeon, tile).length > 0) {
    throw new Error('The tile has a legal placement');
  }
  return { ...run, hand: [] };
}

/** Convenience for bots and tools: startRaid + simulateRaid + resolveRaid. */
export function playRaid(
  data: GameData,
  run: RunState,
  options?: SimulateOptions,
): { run: RunState; result: RaidResult } {
  const started = startRaid(run);
  const result = simulateRaid(data, started, options);
  return { run: resolveRaid(started, result), result };
}
