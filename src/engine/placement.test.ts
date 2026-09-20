import { describe, expect, it } from 'vitest';
import { createBlurayTemplate } from '../templates/bluray';
import { DEFAULT_TRANSFORM } from '../types/editor';
import { computePlacement, paintRect } from './placement';

const t = createBlurayTemplate('US');
const front = t.panels.find((p) => p.id === 'front')!;

describe('computePlacement', () => {
  it('centres by default (null x/y) within the paint area', () => {
    // A portrait 2:3 cover: fits by width, overflows vertically.
    const pl = computePlacement(t, front, 600, 900, DEFAULT_TRANSFORM);
    const area = paintRect(t, front);
    expect(pl.area).toEqual(area);
    expect(pl.widthMm).toBeCloseTo(area.widthMm);
    expect(pl.xMm).toBeCloseTo(0); // exactly as wide as the area
    expect(pl.yMm).toBeCloseTo((area.heightMm - pl.heightMm) / 2);
    expect(pl.yMm).toBeLessThan(0); // taller than the panel, so it starts above the top edge
    expect(pl.xMm).toBe(pl.centeredXMm);
  });

  it('x=0, y=0 puts the image top-left exactly on the panel paint-area corner (bleed included)', () => {
    const pl = computePlacement(t, front, 600, 900, { ...DEFAULT_TRANSFORM, xMm: 0, yMm: 0 });
    // Canvas-space position of the image's top-left:
    expect(pl.area.xMm + pl.xMm).toBe(pl.area.xMm);
    expect(pl.area.yMm + pl.yMm).toBe(0); // the top edge of the canvas, not 3 mm below it
    const spine = t.panels.find((p) => p.id === 'spine')!;
    expect(paintRect(t, spine).yMm).toBe(0);
  });

  it('measures explicit positions from that corner', () => {
    const pl = computePlacement(t, front, 600, 900, { ...DEFAULT_TRANSFORM, xMm: 10, yMm: -5 });
    expect(pl.xMm).toBe(10);
    expect(pl.yMm).toBe(-5);
    expect(pl.centeredYMm).not.toBe(-5);
  });

  it('keeps x centred when only y is set, and re-centres as scale changes', () => {
    const a = computePlacement(t, front, 600, 900, { ...DEFAULT_TRANSFORM, yMm: 0 });
    const b = computePlacement(t, front, 600, 900, { ...DEFAULT_TRANSFORM, yMm: 0, scale: 2 });
    expect(a.xMm).toBeCloseTo(a.centeredXMm);
    expect(b.xMm).toBeCloseTo(b.centeredXMm);
    expect(b.widthMm).toBeCloseTo(a.widthMm * 2);
    expect(b.yMm).toBe(0); // y stays pinned to the top edge
  });
});
