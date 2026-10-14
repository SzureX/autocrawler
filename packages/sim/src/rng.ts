/**
 * Seeded RNG (mulberry32). All randomness in the simulation comes from here.
 * `fork(label, index)` derives an independent stream from the ORIGINAL seed,
 * so forks do not depend on how many numbers the parent already consumed.
 */
export interface Rng {
  readonly seed: number;
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] (inclusive). */
  int(min: number, max: number): number;
  /** True with the given probability. */
  chance(p: number): boolean;
  /** Picks one element uniformly. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Picks one element proportionally to its weight. Zero-weight items are never picked. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  /** Independent stream derived from (seed, label, index). */
  fork(label: string, index?: number | string): Rng;
}

/** FNV-1a 32-bit hash of a string. */
export function hashString(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function forkSeed(seed: number, label: string, index: number | string = 0): number {
  return hashString(`${seed >>> 0}|${label}|${index}`);
}

export function createRng(seed: number): Rng {
  const base = seed >>> 0;
  let state = base;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    seed: base,
    next,
    int(min, max) {
      if (max < min) throw new Error(`rng.int: max ${max} < min ${min}`);
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick(items) {
      if (items.length === 0) throw new Error('rng.pick: empty array');
      return items[Math.floor(next() * items.length)] as (typeof items)[number];
    },
    weighted(items, weight) {
      let total = 0;
      for (const it of items) total += Math.max(0, weight(it));
      if (!(total > 0)) throw new Error('rng.weighted: total weight is zero');
      let roll = next() * total;
      let last: (typeof items)[number] | undefined;
      for (const it of items) {
        const w = Math.max(0, weight(it));
        if (w <= 0) continue;
        last = it;
        if (roll < w) return it;
        roll -= w;
      }
      return last as (typeof items)[number];
    },
    fork(label, index = 0) {
      return createRng(forkSeed(base, label, index));
    },
  };
  return rng;
}
