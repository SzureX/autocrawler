import { create } from 'zustand';
import { loadGameData, type GameData } from '@loch/data';
import { createRun, debugForcePhase, type RunPhase, type RunState } from '@loch/sim';
import { LocalStorageSaveStore, type SaveStore } from '../save/SaveStore';

export const gameData: GameData = loadGameData();
export const saveStore: SaveStore = new LocalStorageSaveStore();

/** Run seed for a new run: random, chosen outside the simulation. */
function freshSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

interface GameStore {
  run: RunState | null;
  startRun: (classId: string, seed?: number) => void;
  setRun: (run: RunState) => void;
  debugSetPhase: (phase: RunPhase) => void;
  resetRun: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  run: saveStore.load(),
  startRun: (classId, seed) => set({ run: createRun(gameData, seed ?? freshSeed(), classId) }),
  setRun: (run) => set({ run }),
  debugSetPhase: (phase) => {
    const { run } = get();
    if (run) set({ run: debugForcePhase(run, phase) });
  },
  resetRun: () => {
    saveStore.clear();
    set({ run: null });
  },
}));

/** Autosave on every phase change (and when a run is created or dropped). */
let lastSavedPhase: RunPhase | null = null;
useGameStore.subscribe((state, prev) => {
  const run = state.run;
  if (run === prev.run) return;
  if (!run) {
    lastSavedPhase = null;
    return;
  }
  if (run.phase !== lastSavedPhase || prev.run === null) {
    lastSavedPhase = run.phase;
    saveStore.save(run);
  }
});
