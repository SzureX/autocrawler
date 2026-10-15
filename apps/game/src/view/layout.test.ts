import { describe, expect, it } from 'vitest';
import { angleDelta, cellToWorld, facingAngle, lungeAmount, smoothing } from './layout';

const board = { width: 9, height: 7 };

describe('layout', () => {
  it('centres the board on the origin, one unit per cell', () => {
    expect(cellToWorld(4, 3, board)).toEqual({ x: 0, z: 0 });
    expect(cellToWorld(0, 0, board)).toEqual({ x: -4, z: -3 });
    expect(cellToWorld(8, 6, board)).toEqual({ x: 4, z: 3 });
  });

  it('smoothing grows with the frame time and never exceeds 1', () => {
    expect(smoothing(0)).toBe(0);
    expect(smoothing(0.016)).toBeGreaterThan(0);
    expect(smoothing(0.1)).toBeGreaterThan(smoothing(0.016));
    expect(smoothing(10)).toBeLessThanOrEqual(1); // saturates to 1.0 in floating point
  });

  it('facing points local +Z along the movement', () => {
    expect(facingAngle(0, 1)).toBeCloseTo(0);
    expect(facingAngle(1, 0)).toBeCloseTo(Math.PI / 2);
    expect(Math.abs(facingAngle(0, -1))).toBeCloseTo(Math.PI);
  });

  it('turns the short way round', () => {
    expect(angleDelta(0.1, 0.3)).toBeCloseTo(0.2);
    expect(angleDelta(3, -3)).toBeCloseTo(2 * Math.PI - 6);
    expect(Math.abs(angleDelta(0, Math.PI))).toBeCloseTo(Math.PI);
  });

  it('lunges only inside the attack window', () => {
    expect(lungeAmount(-1)).toBe(0);
    expect(lungeAmount(5)).toBe(0);
    expect(lungeAmount(0)).toBeCloseTo(0);
    expect(lungeAmount(2.5)).toBeCloseTo(0.3);
  });
});
