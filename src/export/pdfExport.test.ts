import { describe, expect, it } from 'vitest';
import { createBlurayTemplate } from '../templates/bluray';
import { guideSegments } from './pdfExport';

describe('guideSegments', () => {
  it('draws the 4 trim edges (solid) and one fold per panel boundary (dashed) inside the bleed', () => {
    const t = createBlurayTemplate('US');
    const segs = guideSegments(t);
    expect(segs.filter((s) => !s.dashed)).toHaveLength(4);
    const folds = segs.filter((s) => s.dashed);
    expect(folds.map((f) => f.x1)).toEqual([t.panels[1].xMm, t.panels[2].xMm]);
    for (const s of segs) {
      for (const v of [s.x1, s.x2]) expect(v).toBeGreaterThanOrEqual(t.bleedMm);
      for (const v of [s.y1, s.y2]) expect(v).toBeGreaterThanOrEqual(t.bleedMm);
    }
  });
});
