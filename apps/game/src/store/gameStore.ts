import { create } from 'zustand';
import { loadGameData, type GameData } from '@loch/data';
import {
  discardUnplaceableTile,
  continueRun,
  resolveRaid,
  simulateRaid,
  startRaid,
  type RaidResult,
  assignUpgrade,
  buySkill,
  removeUpgrade,
  chooseAndPlaceTile,
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
import { trackRunTransition } from '../telemetry/runEvents';
import { LocalStorageSaveStore, type SaveStore } from '../save/SaveStore';

export const gameData: GameData = loadGameData();
export const saveStore: SaveStore = new LocalStorageSaveStore();

/** Run seed for a new run: random, chosen outside the simulation. */
function freshSeed(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

/** DEV only: ?seed=123 in the URL makes runs reproducible (used by e2e tests). */
function urlSeed(): number | null {
  if (!import.meta.env.DEV) return null;
  const raw = new URLSearchParams(globalThis.location?.search ?? '').get('seed');
  return raw !== null && Number.isFinite(Number(raw)) ? Number(raw) : null;
}

interface GameStore {
  run: RunState | null;
  startRun: (classId: string, seed?: number) => void;
  setRun: (run: RunState) => void;
  chooseTile: (tileUid: string) => void;
  placeTile: (tileUid: string, pos: Pos) => void;
  assignUpgrade: (roomKey: string, upgradeId: string) => void;
  removeUpgrade: (roomKey: string) => void;
  buySkill: (nodeId: string) => void;
  /** Debug: raises the hero's level by one (a skill point each) without any experience. */
  debugAddLevel: () => void;
  debugAddUpgrade: (upgradeId: string) => void;
  equipArtifact: (artifactUid: string, slot: number) => void;
  unequipSlot: (slot: number) => void;
  mergeStack: (artifactId: string, level: 1 | 2 | 3) => void;
  debugAddArtifact: (artifactId: string, level?: 1 | 2 | 3) => void;
  debugSetPhase: (phase: RunPhase) => void;
  /** Debug: counts a won raid and opens the next tile offer (the full flow arrives in M5). */
  debugNextWave: () => void;
  /** Prep -> Action. The raid itself is replayed by the view from the simulated log. */
  /** Safety valve: drops a regular tile that has no legal position. */
  discardTile: () => void;
  startRaid: () => void;
  /** Action -> Resolve: applies the (deterministic) raid result to the run. */
  finishRaid: () => void;
  continueRun: () => void;
  debugResolve: (won: boolean) => void;
  debugSetWaves: (waves: number) => void;
  resetRun: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  run: saveStore.load(),
  startRun: (classId, seed) =>
    set({ run: createRun(gameData, seed ?? urlSeed() ?? freshSeed(), classId) }),
  setRun: (run) => set({ run }),
  chooseTile: (tileUid) => {
    const { run } = get();
    if (run) set({ run: chooseAndPlaceTile(gameData, run, tileUid) });
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
  buySkill: (nodeId) => {
    const { run } = get();
    if (run) set({ run: buySkill(gameData, run, nodeId) });
  },
  debugAddLevel: () => {
    const { run } = get();
    if (run) {
      const level = Math.min(run.level + 1, gameData.balance.heroLevel.maxLevel);
      set({ run: { ...run, level, xp: 0 } });
    }
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
  discardTile: () => {
    const { run } = get();
    if (run) set({ run: discardUnplaceableTile(gameData, run) });
  },
  startRaid: () => {
    const { run } = get();
    if (run) set({ run: startRaid(run) });
  },
  finishRaid: () => {
    const { run } = get();
    if (run) set({ run: resolveRaid(run, simulateRaid(gameData, run, { recordLog: false })) });
  },
  continueRun: () => {
    const { run } = get();
    if (run) set({ run: continueRun(gameData, run) });
  },
  debugResolve: (won) => {
    const { run } = get();
    if (!run || run.phase !== 'Prep' || run.hand.length > 0) return;
    const fake: RaidResult = {
      won,
      reason: won ? 'cleared' : 'died',
      log: [],
      ticks: 0,
      roomsCleared: 0,
      roomsTotal: 0,
      kills: 0,
      xpGained: 0,
      heroHp: 0,
      heroMaxHp: 0,
      death: null,
      lootArtifacts: [],
      lootUpgrades: [],
    };
    set({ run: resolveRaid(startRaid(run), fake) });
  },
  debugSetWaves: (waves) => {
    const { run } = get();
    if (run) set({ run: { ...run, wavesWon: Math.max(0, Math.min(10, waves)) } });
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
  trackRunTransition(prev.run, run);
  if (!run) {
    lastSavedPhase = null;
    return;
  }
  if (run.phase !== lastSavedPhase || prev.run === null) {
    lastSavedPhase = run.phase;
    saveStore.save(run);
  }
});
