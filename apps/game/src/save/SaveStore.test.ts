import { describe, expect, it } from 'vitest';
import { loadGameData } from '@loch/data';
import { createRun } from '@loch/sim';
import { LocalStorageSaveStore, SAVE_KEY, type StorageLike } from './SaveStore';

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

const run = createRun(loadGameData(), 7, 'warrior');

describe('LocalStorageSaveStore', () => {
  it('round-trips a run', () => {
    const storage = fakeStorage();
    const store = new LocalStorageSaveStore(() => storage);
    expect(store.load()).toBeNull();
    store.save(run);
    expect(store.load()).toEqual(run);
    store.clear();
    expect(store.load()).toBeNull();
  });

  it('treats corrupt data as empty', () => {
    const storage = fakeStorage();
    storage.setItem(SAVE_KEY, '{broken');
    expect(new LocalStorageSaveStore(() => storage).load()).toBeNull();
  });

  it('survives a throwing or missing storage', () => {
    const throwing: StorageLike = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    };
    for (const getter of [() => throwing, () => null]) {
      const store = new LocalStorageSaveStore(getter);
      expect(store.load()).toBeNull();
      expect(() => store.save(run)).not.toThrow();
      expect(() => store.clear()).not.toThrow();
    }
  });
});
