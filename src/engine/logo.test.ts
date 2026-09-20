import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { DEFAULT_LOGO } from '../types/editor';
import { computeLogoPlacement } from './logo';

const t = buildTemplate('bluray', 'us-11');
const panel = (id: 'front' | 'spine' | 'back') => t.panels.find((p) => p.id === id)!;

describe('computeLogoPlacement', () => {
  it('centres horizontally on the trimmed panel and sits near the bottom by default', () => {
    const p = panel('front');
    const pl = computeLogoPlacement(t, p, 2, DEFAULT_LOGO);
    expect(pl.widthMm).toBe(24);
    expect(pl.heightMm).toBe(12);
    const centreX = pl.area.xMm + pl.xMm + pl.widthMm / 2;
    expect(centreX).toBeCloseTo(p.xMm + p.widthMm / 2);
    const bottom = pl.area.yMm + pl.yMm + pl.heightMm;
    expect(bottom).toBeCloseTo(p.yMm + p.heightMm - 8); // 8 mm above the trim edge
  });

  it('sizes the spine logo from the spine width so it fits', () => {
    const pl = computeLogoPlacement(t, panel('spine'), 1, DEFAULT_LOGO);
    expect(pl.widthMm).toBeCloseTo(11 * 0.7);
    expect(pl.widthMm).toBeLessThan(panel('spine').widthMm);
  });

  it('uses explicit width and top-left position (from the paint-area corner) when set', () => {
    const pl = computeLogoPlacement(t, panel('back'), 1, { ...DEFAULT_LOGO, widthMm: 10, xMm: 0, yMm: 0 });
    expect(pl.widthMm).toBe(10);
    expect(pl.area.xMm + pl.xMm).toBe(0); // canvas left edge, bleed included
    expect(pl.area.yMm + pl.yMm).toBe(0); // canvas top edge
  });

  it('keeps the other axis at its default when only one is set', () => {
    const base = computeLogoPlacement(t, panel('front'), 2, DEFAULT_LOGO);
    const moved = computeLogoPlacement(t, panel('front'), 2, { ...DEFAULT_LOGO, xMm: 5 });
    expect(moved.xMm).toBe(5);
    expect(moved.yMm).toBe(base.yMm);
  });
});
