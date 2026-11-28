import { describe, expect, it } from 'vitest';
import type { Bounds } from '../../engine/layers/bounds';
import { insideTrim } from './LayerOverlay';

const panel = { id: 'front' as const, label: 'Front', xMm: 10, yMm: 3, widthMm: 120, heightMm: 120 };
const bounds = (rect: Bounds['rect'], rotationDeg = 0) => ({ layer: {} as Bounds['layer'], panel, rect, rotationDeg, auto: false, whole: false, movable: true }) as Bounds;

describe('insideTrim: the part of a selected layer inside its panel\'s trim', () => {
  it('is null for a layer wholly inside the trim', () => {
    expect(insideTrim(bounds({ xMm: 20, yMm: 10, widthMm: 30, heightMm: 30 }))).toBeNull();
  });

  it('is the trimmed part of a layer that runs into the bleed (a side strip out to the left, top and bottom)', () => {
    // The PS1 strip: 18.6 mm wide, painted 3 mm into the bleed on three sides.
    expect(insideTrim(bounds({ xMm: 7, yMm: 0, widthMm: 21.6, heightMm: 126 }))).toEqual({ x: 3, y: 3, w: 18.6, h: 120 });
  });

  it('is null for a turned layer, which an upright clip would not follow', () => {
    expect(insideTrim(bounds({ xMm: 7, yMm: 0, widthMm: 21.6, heightMm: 126 }, 90))).toBeNull();
  });
});
