import type { RunState } from '@loch/sim';
import { track } from './telemetry';

/** Turns a change of the run state into telemetry events (wave, lives, class, equipment, death cause). */
export function trackRunTransition(prev: RunState | null, next: RunState | null): void {
  if (!next) return;
  if (!prev || prev.seed !== next.seed) {
    track('run_started', { classId: next.classId, seed: next.seed });
    return;
  }
  if (prev.phase !== 'Resolve' && next.phase === 'Resolve' && next.lastRaid) {
    track('raid_resolved', {
      classId: next.classId,
      wavesWon: next.wavesWon,
      lives: next.lives,
      won: next.lastRaid.won,
      reason: next.lastRaid.reason,
      killer: next.lastRaid.killer ?? null,
      equipment: next.equipped.flatMap((e) => (e ? [`${e.artifactId}:${e.level}`] : [])),
    });
  }
  if (prev.phase !== next.phase && (next.phase === 'Victory' || next.phase === 'GameOver')) {
    track('run_ended', { outcome: next.phase, wavesWon: next.wavesWon, raids: next.stats.raids });
  }
}
