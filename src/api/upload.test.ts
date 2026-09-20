import { describe, expect, it } from 'vitest';
import { fitWithin } from './upload';

describe('fitWithin', () => {
  it('scales down the longest side and keeps the aspect ratio', () => {
    expect(fitWithin(3200, 1600, 1600)).toEqual({ width: 1600, height: 800 });
    expect(fitWithin(1000, 4000, 1600)).toEqual({ width: 400, height: 1600 });
  });
  it('never scales up, and never returns a zero size', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(fitWithin(5000, 1, 100)).toEqual({ width: 100, height: 1 });
  });
});
