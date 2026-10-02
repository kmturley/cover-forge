import { describe, expect, it } from 'vitest';
import { BRANDS, BRAND_GROUPS, LOGOS, brandAspect, getBrand, getLogo } from './index';

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

describe('supplied logos', () => {
  it('has unique ids and layers with bounds inside the logo', () => {
    expect(LOGOS.length).toBeGreaterThan(0);
    expect(new Set(LOGOS.map((l) => l.id)).size).toBe(LOGOS.length);
    for (const l of LOGOS) {
      expect(l.layers.length, l.id).toBeGreaterThan(0);
      expect(l.bbox[2] - l.bbox[0], l.id).toBeGreaterThan(0);
      for (const layer of l.layers) {
        expect(layer.box[0], l.id).toBeGreaterThanOrEqual(l.bbox[0] - 0.01);
        expect(layer.box[3], l.id).toBeLessThanOrEqual(l.bbox[3] + 0.01);
      }
    }
  });

  it('drops the red square behind the Switch logos and flattens gradients', () => {
    const sw = getLogo('switch2')!;
    expect(sw.layers).toHaveLength(3);
    expect(sw.layers.every((layer) => layer.fill === undefined)).toBe(true);
    expect(getLogo('gamecube')!.layers.every((layer) => layer.fill === undefined || /^#[0-9a-f]{6}$|^none$/.test(layer.fill))).toBe(true);
  });

  it('resolves a gradient that borrows its stops from another', () => {
    // The Sony diamond's inner shape fills with a gradient defined by reference to another one.
    const diamond = getLogo('sony-logo')!.layers[2];
    expect(diamond.fill).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('keeps the two colours of Wii U', () => {
    expect(new Set(getLogo('wii-u')!.layers.map((layer) => layer.fill))).toEqual(new Set(['#009ac7', '#8b8b8b']));
  });
});
