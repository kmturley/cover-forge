import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { guideSegments } from './pdfExport';

describe('guideSegments', () => {
  it('draws cut edges solid and shared panel edges dashed, all inside the canvas', () => {
    const t = buildTemplate('bluray', 'us-11');
    const segs = guideSegments(t);
    expect(segs.filter((s) => s.dashed)).toHaveLength(2); // the two folds beside the spine
    expect(segs.filter((s) => !s.dashed).length).toBeGreaterThanOrEqual(4);
    for (const s of segs) {
      for (const v of [s.x1, s.x2]) expect(v).toBeGreaterThanOrEqual(t.bleedMm);
      for (const v of [s.y1, s.y2]) expect(v).toBeGreaterThanOrEqual(t.bleedMm);
      for (const v of [s.x1, s.x2]) expect(v).toBeLessThanOrEqual(t.totalWidthMm - t.bleedMm);
    }
  });

  it('has no dashed lines for a single-panel template', () => {
    expect(guideSegments(buildTemplate('nfc-card')).filter((s) => s.dashed)).toHaveLength(0);
  });
});
