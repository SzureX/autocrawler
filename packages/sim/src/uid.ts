import type { RunState } from './types';

/** Mints a unique deterministic id (prefix-N) and returns the run with an advanced counter. */
export function mintUid(run: RunState, prefix: string): { uid: string; run: RunState } {
  return { uid: `${prefix}-${run.nextUid}`, run: { ...run, nextUid: run.nextUid + 1 } };
}
