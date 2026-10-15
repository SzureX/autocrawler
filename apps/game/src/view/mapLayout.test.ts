import { describe, expect, it } from 'vitest';
import { mapBounds, roomPitch, roomRect, roomWorld } from './mapLayout';

const board = { width: 9, height: 7 };

describe('map layout', () => {
  it('neighbouring rooms share one wall (pitch = floor + wall)', () => {
    expect(roomPitch(board)).toEqual({ x: 9.5, z: 7.5 });
    expect(roomWorld(2, 3, board)).toEqual({ x: 19, z: 22.5 });
  });

  it('a room rectangle covers its floor and walls', () => {
    const r = roomRect('1,4', board);
    expect(r.maxX - r.minX).toBe(9.5);
    expect(r.maxZ - r.minZ).toBe(7.5);
    expect((r.minX + r.maxX) / 2).toBe(9.5);
  });

  it('bounds contain every room with a margin', () => {
    const b = mapBounds(['0,4', '2,4'], board);
    expect(b.minX).toBeLessThan(-4.75);
    expect(b.maxX).toBeGreaterThan(19 + 4.75);
    expect(b.maxZ - b.minZ).toBeGreaterThan(7.5);
  });
});
