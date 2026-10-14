import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

const take = (n: number, f: () => number): number[] => Array.from({ length: n }, f);

describe('rng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(123);
    const b = createRng(123);
    expect(take(50, a.next)).toEqual(take(50, b.next));
  });

  it('differs between seeds', () => {
    expect(take(10, createRng(1).next)).not.toEqual(take(10, createRng(2).next));
  });

  it('returns floats in [0, 1)', () => {
    const r = createRng(7);
    for (const v of take(1000, r.next)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int covers the inclusive range', () => {
    const r = createRng(9);
    const seen = new Set(take(500, () => r.int(4, 6)));
    expect([...seen].sort()).toEqual([4, 5, 6]);
  });

  it('fork is independent of the parent state', () => {
    const a = createRng(5);
    const b = createRng(5);
    take(100, b.next); // consume the parent stream
    expect(take(10, a.fork('tiles', 3).next)).toEqual(take(10, b.fork('tiles', 3).next));
  });

  it('fork streams differ by label and index', () => {
    const r = createRng(5);
    const base = take(5, r.fork('tiles', 0).next);
    expect(take(5, r.fork('tiles', 1).next)).not.toEqual(base);
    expect(take(5, r.fork('drops', 0).next)).not.toEqual(base);
  });

  it('weighted respects weights and skips zero weights', () => {
    const r = createRng(11);
    const items = [
      { id: 'a', w: 0 },
      { id: 'b', w: 1 },
      { id: 'c', w: 9 },
    ];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 5000; i++) {
      const picked = r.weighted(items, (it) => it.w);
      counts[picked.id] = (counts[picked.id] ?? 0) + 1;
    }
    expect(counts['a']).toBe(0);
    expect((counts['c'] ?? 0) / 5000).toBeGreaterThan(0.85);
    expect((counts['b'] ?? 0) / 5000).toBeGreaterThan(0.05);
  });

  it('pick and weighted throw on empty input', () => {
    expect(() => createRng(1).pick([])).toThrow();
    expect(() => createRng(1).weighted([], () => 1)).toThrow();
  });
});
