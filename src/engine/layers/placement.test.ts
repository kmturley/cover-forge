import { describe, expect, it } from 'vitest';
import { boxToPlacement, placementToBox } from './placement';

const panel = { widthMm: 130, heightMm: 180 };

describe('placementToBox', () => {
  it('stretches between edges, as a PanelBox always did', () => {
    expect(placementToBox(panel, { x: { anchor: 'stretch', start: 0, end: 0 }, y: { anchor: 'stretch', start: 10, end: 25 } })).toEqual({ xStart: 0, xEnd: 100, yStart: 10, yEnd: 75 });
  });

  it('places a block by its start edge and a size: left edge to 80%', () => {
    const b = placementToBox(panel, { x: { anchor: 'start', offset: 0, size: 80 }, y: { anchor: 'stretch', start: 0, end: 0 } });
    expect([b.xStart, b.xEnd]).toEqual([0, 80]);
  });

  it('centres a logo 10% wide without any start/end arithmetic', () => {
    const b = placementToBox(panel, { x: { anchor: 'center', offset: 50, size: 10 }, y: { anchor: 'start', offset: 5, size: 20 } });
    expect([b.xStart, b.xEnd]).toEqual([45, 55]);
    expect([b.yStart, b.yEnd]).toEqual([5, 25]);
  });

  it('keeps a centred layer centred when its size changes', () => {
    const at = (size: number) => placementToBox(panel, { x: { anchor: 'center', offset: 50, size }, y: { anchor: 'stretch', start: 0, end: 0 } });
    for (const size of [4, 10, 33, 90]) {
      const b = at(size);
      expect((b.xStart + b.xEnd) / 2).toBeCloseTo(50);
      expect(b.xEnd - b.xStart).toBeCloseTo(size);
    }
  });

  it('anchors to the far edge: 8% in from the right, 4% up from the bottom', () => {
    const b = placementToBox(panel, { x: { anchor: 'end', offset: 8, size: 14 }, y: { anchor: 'end', offset: 4, size: 10 } });
    expect([b.xStart, b.xEnd]).toEqual([78, 92]);
    expect([b.yStart, b.yEnd]).toEqual([86, 96]);
  });

  it('takes an auto height from the content shape through the panel size, not the percentages', () => {
    // 13 mm wide (10% of 130), content twice as wide as tall: 6.5 mm tall = 3.611…% of 180 mm.
    const b = placementToBox(panel, { x: { anchor: 'center', offset: 50, size: 10 }, y: { anchor: 'start', offset: 5, size: 'auto' } }, 2);
    expect(b.yStart).toBe(5);
    expect(((b.yEnd - b.yStart) / 100) * panel.heightMm).toBeCloseTo(6.5);
  });

  it('takes an auto width from the height the same way', () => {
    const b = placementToBox(panel, { x: { anchor: 'start', offset: 0, size: 'auto' }, y: { anchor: 'start', offset: 0, size: 20 } }, 0.5);
    // 20% of 180 mm = 36 mm tall, half as wide as tall: 18 mm = 13.846…% of 130 mm.
    expect(((b.xEnd - b.xStart) / 100) * panel.widthMm).toBeCloseTo(18);
  });

  it('falls back to the whole panel along an auto axis when the content shape is unknown, or both are auto', () => {
    expect(placementToBox(panel, { x: { anchor: 'start', offset: 0, size: 10 }, y: { anchor: 'start', offset: 0, size: 'auto' } })).toMatchObject({ yStart: 0, yEnd: 100 });
    expect(placementToBox(panel, { x: { anchor: 'start', offset: 0, size: 'auto' }, y: { anchor: 'start', offset: 0, size: 'auto' } }, 1)).toEqual({ xStart: 0, xEnd: 100, yStart: 0, yEnd: 100 });
  });

  it('reaches into the bleed with negative and over-100 values', () => {
    const b = placementToBox(panel, { x: { anchor: 'stretch', start: -2, end: -2 }, y: { anchor: 'start', offset: -3, size: 106 } });
    expect(b).toEqual({ xStart: -2, xEnd: 102, yStart: -3, yEnd: 103 });
  });
});

describe('boxToPlacement', () => {
  it('round-trips every box', () => {
    for (const box of [{ xStart: 0, xEnd: 100, yStart: 0, yEnd: 100 }, { xStart: 12.34, xEnd: 87.65, yStart: -5, yEnd: 33.33 }]) {
      const back = placementToBox(panel, boxToPlacement(box));
      for (const k of ['xStart', 'xEnd', 'yStart', 'yEnd'] as const) expect(back[k]).toBeCloseTo(box[k], 9);
    }
  });
});
