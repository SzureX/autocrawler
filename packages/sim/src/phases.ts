import type { RunPhase, RunState } from './types';

/** Allowed phase transitions (CLAUDE.md 6.1). */
const TRANSITIONS: Record<RunPhase, readonly RunPhase[]> = {
  ClassSelect: ['TileOffer'],
  TileOffer: ['Prep'],
  BossOffer: ['Prep'],
  Prep: ['Action'],
  Action: ['Resolve'],
  Resolve: ['TileOffer', 'BossOffer', 'Prep', 'GameOver', 'Victory'],
  Victory: [],
  GameOver: [],
};

export function canTransition(from: RunPhase, to: RunPhase): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowedTransitions(from: RunPhase): readonly RunPhase[] {
  return TRANSITIONS[from];
}

/** Pure phase change; throws on a transition the state machine does not allow. */
export function setPhase(run: RunState, to: RunPhase): RunState {
  if (!canTransition(run.phase, to)) {
    throw new Error(`Illegal phase transition ${run.phase} -> ${to}`);
  }
  return { ...run, phase: to };
}

/** Debug-only: forces any phase, bypassing the state machine. */
export function debugForcePhase(run: RunState, to: RunPhase): RunState {
  return { ...run, phase: to };
}
