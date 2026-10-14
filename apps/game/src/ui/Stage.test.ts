import { describe, expect, it } from 'vitest';
import { fitScale } from './Stage';

describe('fitScale', () => {
  it('is 1 at the design resolution', () => {
    expect(fitScale(1920, 1080)).toBe(1);
  });
  it('fits the limiting dimension and keeps the ratio', () => {
    expect(fitScale(960, 1080)).toBe(0.5); // narrow window: width limits
    expect(fitScale(3840, 1080)).toBe(1); // wide window: height limits
    expect(fitScale(1280, 720)).toBeCloseTo(2 / 3, 5);
  });
});
