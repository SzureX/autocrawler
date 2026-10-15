import { describe, expect, it } from 'vitest';
import {
  blockedFromLayout,
  doorCellOf,
  validateLayout,
  type Bounds,
  type BoundsSource,
} from './layoutTools';
import type { RoomLayout } from './roomBuilder';

const board = { width: 9, height: 7 };

const box = (w: number, d: number, h: number, ox = 0, oz = 0): Bounds => ({
  min: { x: ox - w / 2, y: 0, z: oz - d / 2 },
  max: { x: ox + w / 2, y: h, z: oz + d / 2 },
});

/** Model sizes in native units (the real ones: a barrel 1.8 x 2.0 x 1.8, a candle 0.33 wide...). */
const sizes: Record<string, Bounds> = {
  'prop:barrel_large': box(1.8, 1.8, 2),
  'prop:table_long': box(2, 4, 1),
  'prop:candle': box(0.33, 0.33, 0.87),
  'prop:ceiling_tile': box(4, 4, 0.1),
  'prop:banner_red': box(1.5, 0.3, 3.2),
  'floor:tile_small': { min: { x: -1, y: -0.1, z: -1 }, max: { x: 1, y: 0.05, z: 1 } },
  'floor:foundation_front': { min: { x: -1, y: 0, z: -1 }, max: { x: 1, y: 2, z: 1.1 } },
};
const source: BoundsSource = {
  bounds: (key) => sizes[key] ?? box(1, 1, 1),
};
const floorSize = () => ({ w: 1, h: 1 });

const layout = (over: Partial<RoomLayout> = {}): RoomLayout => ({ floors: [], props: [], ...over });

describe('blocked cells', () => {
  it('a barrel blocks the cell it stands in (and not its neighbours)', () => {
    const blocked = blockedFromLayout(
      layout({ props: [{ id: 'barrel_large', x: 1, z: 1, rot: 0 }] }),
      board,
      source,
      floorSize,
    );
    // Cell centres are whole numbers: x = 1 is the middle of column 5, z = 1 the middle of row 4.
    expect(blocked).toEqual([[5, 4]]);
  });

  it('a long table covers several cells and turning it changes which', () => {
    const along = blockedFromLayout(
      layout({ props: [{ id: 'table_long', x: 1, z: 0.5, rot: 0 }] }),
      board,
      source,
      floorSize,
    );
    expect(along).toEqual([
      [5, 3],
      [5, 4],
    ]);
    const turned = blockedFromLayout(
      layout({ props: [{ id: 'table_long', x: 0.5, z: 1, rot: 2 }] }),
      board,
      source,
      floorSize,
    );
    expect(turned).toEqual([
      [4, 4],
      [5, 4],
    ]);
  });

  it('small, flat and wall-mounted props never block', () => {
    const blocked = blockedFromLayout(
      layout({
        props: [
          { id: 'candle', x: 0.5, z: 0.5, rot: 0 },
          { id: 'ceiling_tile', x: 0.5, z: 0.5, rot: 0 },
          { id: 'banner_red', x: 0, z: -3.75, rot: 0 },
          { id: 'barrel_large', x: 1.5, z: 0.5, rot: 0, y: 1 },
        ],
      }),
      board,
      source,
      floorSize,
    );
    expect(blocked).toEqual([]);
  });

  it('tall floor pieces block their cells, flat ones do not', () => {
    const blocked = blockedFromLayout(
      layout({
        floors: [
          { id: 'tile_small', x: 1, y: 1, rot: 0 },
          { id: 'foundation_front', x: 2, y: 2, rot: 0 },
        ],
      }),
      board,
      source,
      floorSize,
    );
    expect(blocked).toEqual([[2, 2]]);
  });
});

describe('validation', () => {
  const base = {
    layout: layout({ floors: [{ id: 'tile_small', x: 0, y: 0, rot: 0 }] }),
    board,
    doors: ['W', 'E'] as ('N' | 'E' | 'S' | 'W')[],
    reserved: [] as [number, number][],
    mustReach: [] as [number, number][],
    floorSize,
  };

  it('door cells sit in the middle of each side', () => {
    expect(doorCellOf('N', board)).toEqual([4, 0]);
    expect(doorCellOf('S', board)).toEqual([4, 6]);
    expect(doorCellOf('W', board)).toEqual([0, 3]);
    expect(doorCellOf('E', board)).toEqual([8, 3]);
  });

  it('an empty room is valid but the missing floor is only a warning', () => {
    const r = validateLayout({ ...base, blocked: [] });
    expect(r.errors).toEqual([]);
    expect(r.warnings.map((w) => w.key)).toEqual(['dev.layout.issue.holes']);
  });

  it('a blocked door or reserved cell is an error', () => {
    const door = validateLayout({ ...base, blocked: [[0, 3]] });
    expect(door.errors.map((e) => e.key)).toContain('dev.layout.issue.door');
    const reserved = validateLayout({ ...base, reserved: [[4, 2]], blocked: [[4, 2]] });
    expect(reserved.errors.map((e) => e.key)).toContain('dev.layout.issue.reserved');
  });

  it('a wall of props that cuts the room in two is an error', () => {
    const wall: [number, number][] = [0, 1, 2, 3, 4, 5, 6].map((y) => [4, y]);
    const r = validateLayout({ ...base, blocked: wall });
    expect(r.errors.map((e) => e.key)).toContain('dev.layout.issue.isolated');
    expect(r.errors.map((e) => e.key)).toContain('dev.layout.issue.unreachable');
  });

  it('a gap in the wall keeps the room connected', () => {
    const wall: [number, number][] = [0, 1, 2, 4, 5, 6].map((y) => [4, y]);
    const r = validateLayout({ ...base, blocked: wall });
    expect(r.errors).toEqual([]);
  });

  it('a pocket closed by props (even diagonally open ones count as open) is detected', () => {
    // A single free cell fully surrounded.
    const ring: [number, number][] = [
      [1, 1],
      [2, 1],
      [3, 1],
      [1, 2],
      [3, 2],
      [1, 3],
      [2, 3],
      [3, 3],
    ];
    const r = validateLayout({ ...base, blocked: ring });
    expect(r.errors.map((e) => e.key)).toContain('dev.layout.issue.isolated');
  });

  it('the cell in front of the chest must be reachable', () => {
    const r = validateLayout({
      ...base,
      mustReach: [[4, 3]],
      blocked: [
        [3, 2],
        [4, 2],
        [5, 2],
        [3, 3],
        [5, 3],
        [3, 4],
        [4, 4],
        [5, 4],
      ],
    });
    expect(r.errors.map((e) => e.key)).toContain('dev.layout.issue.unreachable');
  });
});
