import { create } from 'zustand';
import { loadGameData, type GameData } from '@loch/data';
import {
  chooseTile,
  createRun,
  debugForcePhase,
  generateBossOffer,
  generateTileOffer,
  placeTile,
  type Pos,
  type RunPhase,
  type RunState,
} from '@loch/sim';
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
  chooseTile: (tileUid: string) => void;
  placeTile: (tileUid: string, pos: Pos) => void;
  debugSetPhase: (phase: RunPhase) => void;
  /** Debug: counts a won raid and opens the next tile offer (the full flow arrives in M5). */
  debugNextWave: () => void;
  resetRun: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  run: saveStore.load(),
  startRun: (classId, seed) => set({ run: createRun(gameData, seed ?? freshSeed(), classId) }),
  setRun: (run) => set({ run }),
  chooseTile: (tileUid) => {
    const { run } = get();
    if (run) set({ run: chooseTile(run, tileUid) });
  },
  placeTile: (tileUid, pos) => {
    const { run } = get();
    if (run) set({ run: placeTile(gameData, run, tileUid, pos) });
  },
  debugSetPhase: (phase) => {
    const { run } = get();
    if (run) set({ run: debugForcePhase(run, phase) });
  },
  debugNextWave: () => {
    const { run } = get();
    if (!run) return;
    const next = { ...run, wavesWon: run.wavesWon + 1 };
    const boss = next.wavesWon >= gameData.balance.wavesToBoss;
    set({
      run: boss
        ? { ...generateBossOffer(gameData, next), phase: 'BossOffer' }
        : { ...generateTileOffer(gameData, next), phase: 'TileOffer' },
    });
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
