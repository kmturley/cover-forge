import { describe, expect, it } from 'vitest';
import { impose, paginate } from './imposition';

describe('impose', () => {
  it('fits one Blu-ray wrap (273×154) rotated on A4', () => {
    const r = impose(273, 154, 'A4');
    expect(r.placements).toHaveLength(1);
    expect(r.placements[0].rotated).toBe(true);
    expect(r.oversize).toBe(false);
  });

  it('fits one wrap on US Letter only with a small margin', () => {
    expect(impose(273, 154, 'Letter').placements).toHaveLength(1);
    expect(impose(273, 154, 'Letter', { marginMm: 5 }).oversize).toBe(true);
  });

  it('packs many small items and centres the grid', () => {
    const r = impose(69.85, 69.85, 'Letter', { marginMm: 0, gutterMm: 0 });
    expect(r.placements).toHaveLength(12); // 3 cols × 4 rows
    const xs = r.placements.map((p) => p.xMm);
    expect(Math.min(...xs)).toBeCloseTo((215.9 - 3 * 69.85) / 2);
  });

  it('flags an item bigger than the paper', () => {
    const r = impose(400, 400, 'A4');
    expect(r.oversize).toBe(true);
    expect(r.placements).toHaveLength(1);
  });
});

describe('paginate', () => {
  it('chunks items per sheet', () => {
    expect(paginate([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(paginate([], 2)).toEqual([]);
  });
});
