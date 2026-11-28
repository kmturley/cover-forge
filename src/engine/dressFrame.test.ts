import { describe, expect, it } from 'vitest';
import type { PanelRect } from '../types/template';
import { dressFrame } from './branding';

const panel = (widthMm: number, heightMm: number, turnedFrom?: PanelRect['turnedFrom']): PanelRect => ({ id: 'front', label: 'Front', xMm: 3, yMm: 3, widthMm, heightMm, ...(turnedFrom && { turnedFrom }) });
/** A platform's own insert: 129.5 × 183 mm (a DVD-size case). */
const ref = { w: 129.5, h: 183, spine: 183, spineW: 14 };

describe('dressFrame: what a dress\'s shares are taken of, mm', () => {
  it('is the panel itself on the platform\'s own case, so nothing moves', () => {
    expect(dressFrame(ref, panel(129.5, 183))).toEqual({ w: 129.5, h: 183 });
  });

  it('keeps the own case\'s size on a bigger panel (a slipcover, a box), rather than stretching with it', () => {
    expect(dressFrame(ref, panel(136.5, 191.5))).toEqual({ w: 129.5, h: 183 });
  });

  it('keeps the width in mm on a narrower panel, and shrinks down to a shorter one', () => {
    expect(dressFrame(ref, panel(99, 161))).toEqual({ w: 129.5, h: 161 });
  });

  it('lays a turned panel out on its portrait size', () => {
    expect(dressFrame(ref, panel(183, 129.5, { widthMm: 129.5, heightMm: 183 }))).toEqual({ w: 129.5, h: 183 });
  });

  it('follows the panel when the dress has no own case (a format\'s small logos)', () => {
    expect(dressFrame(undefined, panel(128, 149))).toEqual({ w: 128, h: 149 });
    expect(dressFrame(undefined, panel(149, 128, { widthMm: 128, heightMm: 149 }))).toEqual({ w: 128, h: 149 });
  });
});
