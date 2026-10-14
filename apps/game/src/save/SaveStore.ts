import { deserializeRun, serializeRun, type RunState } from '@loch/sim';

/** The only way the app persists a run. Swap the implementation to change where saves live. */
export interface SaveStore {
  load(): RunState | null;
  save(state: RunState): void;
  clear(): void;
}

export const SAVE_KEY = 'loch-roguelite:run';

/** Minimal surface of Storage, so tests can pass a fake. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Never throws: a missing, blocked or corrupt storage behaves like an empty one. */
export class LocalStorageSaveStore implements SaveStore {
  private readonly getStorage: () => StorageLike | null;

  constructor(getStorage?: () => StorageLike | null) {
    this.getStorage =
      getStorage ??
      (() => {
        try {
          return globalThis.localStorage ?? null;
        } catch {
          return null;
        }
      });
  }

  load(): RunState | null {
    try {
      const text = this.getStorage()?.getItem(SAVE_KEY);
      return text ? deserializeRun(text) : null;
    } catch {
      return null;
    }
  }

  save(state: RunState): void {
    try {
      this.getStorage()?.setItem(SAVE_KEY, serializeRun(state));
    } catch {
      // Quota exceeded or storage disabled: the run continues without autosave.
    }
  }

  clear(): void {
    try {
      this.getStorage()?.removeItem(SAVE_KEY);
    } catch {
      // Nothing to clear.
    }
  }
}
