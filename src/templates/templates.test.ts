import { describe, expect, it } from 'vitest';
import { canvasSizePx, templatesForRegion } from './index';
import { createBlurayTemplate } from './bluray';

describe('bluray template', () => {
  it('matches the spec for the US standard case', () => {
    const t = createBlurayTemplate('US');
    expect(t.trimWidthMm).toBe(269);
    expect(t.totalWidthMm).toBe(275);
    expect(t.totalHeightMm).toBe(155);
    expect(canvasSizePx(t)).toEqual({ width: 3248, height: 1831 });
  });

  it('lays panels out contiguously', () => {
    const t = createBlurayTemplate('EU');
    const [back, spine, front] = t.panels;
    expect(spine.xMm).toBe(back.xMm + back.widthMm);
    expect(front.xMm).toBe(spine.xMm + spine.widthMm);
    expect(spine.widthMm).toBe(14);
  });

  it('filters templates by region', () => {
    expect(templatesForRegion('US').map((t) => t.spineMm)).toEqual([11, 12.5]);
    expect(templatesForRegion('EU').map((t) => t.spineMm)).toEqual([14]);
  });
});
