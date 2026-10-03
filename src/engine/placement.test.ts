import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { DEFAULT_TRANSFORM, type PanelTransform } from '../types/editor';
import { computePlacement, paintRect } from './placement';
import { boxRect, rectToBox } from './box';

const t = buildTemplate('bluray', 'us-11');
const front = t.panels.find((p) => p.id === 'front')!;
const near = (a: { xMm: number; yMm: number; widthMm: number; heightMm: number }, b: typeof a) =>
  (['xMm', 'yMm', 'widthMm', 'heightMm'] as const).forEach((k) => expect(a[k]).toBeCloseTo(b[k]));
const box = (xStart: number, xEnd: number, yStart: number, yEnd: number) => ({ xStart, xEnd, yStart, yEnd });

describe('computePlacement', () => {
  it('fills the whole panel, bleed included, by default: centred, cropped, never distorted', () => {
    // A portrait 2:3 cover: as wide as the area, overflowing it vertically.
    const pl = computePlacement(t, front, 600, 900, DEFAULT_TRANSFORM);
    const area = paintRect(t, front);
    expect(pl.area).toEqual(area);
    expect(pl.widthMm).toBeCloseTo(area.widthMm);
    expect(pl.heightMm / pl.widthMm).toBeCloseTo(1.5);
    expect(pl.xMm).toBeCloseTo(0);
    expect(pl.yMm).toBeCloseTo((area.heightMm - pl.heightMm) / 2);
    near(pl.clip, area);
  });

  it('fills a box: covers it, centred on it, and is cropped to it', () => {
    const b = box(10, 60, 20, 40);
    const pl = computePlacement(t, front, 600, 900, { ...DEFAULT_TRANSFORM, box: b });
    const r = boxRect(front, b);
    expect(pl.widthMm).toBeGreaterThanOrEqual(r.widthMm - 1e-9);
    expect(pl.heightMm).toBeGreaterThanOrEqual(r.heightMm - 1e-9);
    expect(pl.area.xMm + pl.xMm + pl.widthMm / 2).toBeCloseTo(r.xMm + r.widthMm / 2);
    expect(pl.area.yMm + pl.yMm + pl.heightMm / 2).toBeCloseTo(r.yMm + r.heightMm / 2);
    near(pl.clip, r);
  });

  it('fits a box: the whole image inside it, as large as it can be', () => {
    const b = box(0, 100, 0, 50);
    const pl = computePlacement(t, front, 600, 900, { ...DEFAULT_TRANSFORM, box: b, fit: 'fit' });
    const r = boxRect(front, b);
    expect(pl.heightMm).toBeCloseTo(r.heightMm); // a portrait image in a landscape box: limited by height
    expect(pl.widthMm).toBeLessThan(r.widthMm);
    expect(pl.heightMm / pl.widthMm).toBeCloseTo(1.5);
  });

  it('puts a box in the same place, relative to the panel, on every case size', () => {
    const b = box(50, 100, 0, 25);
    for (const tpl of [buildTemplate('dvd', 'std-14'), buildTemplate('game-case', 'switch'), buildTemplate('cd')]) {
      const f = tpl.panels.find((p) => p.id === 'front')!;
      const pl = computePlacement(tpl, f, 100, 100, { ...DEFAULT_TRANSFORM, box: b });
      expect(pl.clip.xMm).toBeCloseTo(f.xMm + f.widthMm / 2);
      expect(pl.clip.xMm + pl.clip.widthMm).toBeCloseTo(f.xMm + f.widthMm);
    }
  });

  it('only crops to the paint area when a box reaches past it', () => {
    const pl = computePlacement(t, front, 600, 900, { ...DEFAULT_TRANSFORM, box: box(-50, 150, -50, 150) });
    near(pl.clip, paintRect(t, front));
  });
});

describe('an older save’s mm placement', () => {
  // As stored before boxes: no `box` at all.
  const legacy = (o: Partial<PanelTransform>): PanelTransform => ({ fit: 'fill', rotationDeg: 0, opacity: 1, ...o }) as PanelTransform;

  it('renders exactly as before: x/y from the paint-area corner, scale 1 covering it', () => {
    const pl = computePlacement(t, front, 600, 900, legacy({ xMm: 10, yMm: -5, scale: 2 }));
    const area = paintRect(t, front);
    expect(pl.xMm).toBe(10);
    expect(pl.yMm).toBe(-5);
    expect(pl.widthMm).toBeCloseTo(area.widthMm * 2);
    near(pl.clip, area);
  });

  it('centres an unset axis', () => {
    const pl = computePlacement(t, front, 600, 900, legacy({ yMm: 0 }));
    expect(pl.xMm).toBeCloseTo((pl.area.widthMm - pl.widthMm) / 2);
    expect(pl.yMm).toBe(0);
  });

  it('becomes a box that draws the image in the same place when it is next edited', () => {
    const before = computePlacement(t, front, 1920, 620, legacy({ xMm: -40, yMm: 12, scale: 1.3 }));
    const after = computePlacement(t, front, 1920, 620, { ...DEFAULT_TRANSFORM, box: rectToBox(front, before.box) });
    expect(after.xMm).toBeCloseTo(before.xMm, 1);
    expect(after.yMm).toBeCloseTo(before.yMm, 1);
    expect(after.widthMm).toBeCloseTo(before.widthMm, 1);
  });
});
