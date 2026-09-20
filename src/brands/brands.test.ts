import { describe, expect, it } from 'vitest';
import { BRANDS, BRAND_GROUPS, brandAspect, getBrand } from './index';

describe('brand data', () => {
  it('has unique ids and well-formed entries', () => {
    expect(new Set(BRANDS.map((b) => b.id)).size).toBe(BRANDS.length);
    for (const b of BRANDS) {
      expect(b.path.length, b.id).toBeGreaterThan(20);
      expect(b.hex, b.id).toMatch(/^[0-9A-Fa-f]{6}$/);
      const [x0, y0, x1, y1] = b.bbox;
      expect(x1 - x0, b.id).toBeGreaterThan(0);
      expect(y1 - y0, b.id).toBeGreaterThan(0);
      // Simple Icons paths live in a 24×24 box.
      expect(Math.min(x0, y0), b.id).toBeGreaterThanOrEqual(-0.5);
      expect(Math.max(x1, y1), b.id).toBeLessThanOrEqual(24.5);
    }
  });

  it('covers the main stores and consoles, grouped', () => {
    for (const id of ['steam', 'epicgames', 'gogdotcom', 'playstation5']) expect(getBrand(id), id).toBeDefined();
    expect(BRAND_GROUPS.map((g) => g.category)).toEqual(['store', 'platform']);
    expect(BRAND_GROUPS.flatMap((g) => g.brands)).toHaveLength(BRANDS.length);
    expect(getBrand('nope')).toBeUndefined();
    expect(getBrand(null)).toBeUndefined();
  });

  it('derives aspect ratios from the tight bounds', () => {
    expect(brandAspect(getBrand('steam')!)).toBeGreaterThan(0.5);
  });
});
