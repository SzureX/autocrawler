import { describe, expect, it } from 'vitest';
import { SIDES } from './roomBuilder';
import { LOW_WALL, WALL_OFFSET, wallPlacements } from './wallLayout';

const board = { width: 9, height: 7 };

describe('wallPlacements', () => {
  it('draws the same wall pieces the raid view always used when every side has a door', () => {
    const walls = wallPlacements(board, SIDES);
    expect(walls).toHaveLength(20);
    expect(walls.filter((w) => w.model === 'door:doorway')).toHaveLength(4);
    expect(walls.filter((w) => w.model === 'wall:half')).toHaveLength(4);
    expect(walls.filter((w) => w.model === 'wall:arched')).toHaveLength(12);
  });

  it('puts the doorways on the middle of each side, facing the room', () => {
    const doorways = wallPlacements(board, SIDES).filter((w) => w.model === 'door:doorway');
    const find = (x: number, z: number) =>
      doorways.find((w) => Math.abs(w.x - x) < 1e-9 && Math.abs(w.z - z) < 1e-9);
    expect(find(0, -(3.5 + WALL_OFFSET))?.yaw).toBe(0); // north
    expect(find(0, 3.5 + WALL_OFFSET)?.yaw).toBeCloseTo(Math.PI); // south
    expect(find(-(4.5 + WALL_OFFSET), 0)?.yaw).toBeCloseTo(Math.PI / 2); // west
    expect(find(4.5 + WALL_OFFSET, 0)?.yaw).toBeCloseTo(-Math.PI / 2); // east
  });

  it('keeps the south wall low and squeezes the north and south arches to fit', () => {
    const walls = wallPlacements(board, SIDES);
    const south = walls.filter((w) => w.z > 3.5);
    expect(south.length).toBeGreaterThan(0);
    expect(south.every((w) => w.sy === LOW_WALL)).toBe(true);
    const arch = walls.find((w) => w.model === 'wall:arched' && Math.abs(w.z) > 3.5);
    expect(arch?.sx).toBeCloseTo(0.875);
  });

  it('replaces a doorway by a plain arch on sides without a door', () => {
    const walls = wallPlacements(board, ['W', 'E']);
    expect(walls.filter((w) => w.model === 'door:doorway')).toHaveLength(2);
    expect(walls).toHaveLength(wallPlacements(board, SIDES).length);
    const north = walls.filter((w) => w.z < -3.5 && w.x === 0);
    expect(north.map((w) => w.model)).toEqual(['wall:arched']);
  });

  it('mirrors the half walls so they grow away from the doorway', () => {
    const halves = wallPlacements(board, SIDES).filter((w) => w.model === 'wall:half');
    expect(halves.map((w) => Math.sign(w.sx)).sort()).toEqual([-1, -1, 1, 1]);
  });
});
