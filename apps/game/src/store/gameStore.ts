import { create } from 'zustand';
import { loadGameData, type GameData } from '@loch/data';
import {
  assignUpgrade,
  removeUpgrade,
  chooseTile,
  createRun,
  debugForcePhase,
  equip,
  generateBossOffer,
  generateTileOffer,
  grantArtifact,
  mergeArtifacts,
  placeTile,
  unequip,
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
  assignUpgrade: (roomKey: string, upgradeId: string) => void;
  removeUpgrade: (roomKey: string) => void;
  debugAddUpgrade: (upgradeId: string) => void;
  equipArtifact: (artifactUid: string, slot: number) => void;
  unequipSlot: (slot: number) => void;
  mergeStack: (artifactId: string, level: 1 | 2 | 3) => void;
  debugAddArtifact: (artifactId: string, level?: 1 | 2 | 3) => void;
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
  assignUpgrade: (roomKey, upgradeId) => {
    const { run } = get();
    if (run) set({ run: assignUpgrade(gameData, run, roomKey, upgradeId) });
  },
  removeUpgrade: (roomKey) => {
    const { run } = get();
    if (run) set({ run: removeUpgrade(run, roomKey) });
  },
  debugAddUpgrade: (upgradeId) => {
    const { run } = get();
    if (run) set({ run: { ...run, upgradeStorage: [...run.upgradeStorage, upgradeId] } });
  },
  equipArtifact: (artifactUid, slot) => {
    const { run } = get();
    if (run) set({ run: equip(run, artifactUid, slot) });
  },
  unequipSlot: (slot) => {
    const { run } = get();
    if (run) set({ run: unequip(run, slot) });
  },
  mergeStack: (artifactId, level) => {
    const { run } = get();
    if (run) set({ run: mergeArtifacts(gameData, run, artifactId, level) });
  },
  debugAddArtifact: (artifactId, level = 1) => {
    const { run } = get();
    if (run) set({ run: grantArtifact(gameData, run, artifactId, level) });
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
