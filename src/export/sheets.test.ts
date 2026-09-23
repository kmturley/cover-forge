import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { PAPER_MM } from './imposition';
import { LABEL_SHEETS, computeLayout, imposeOnLabels, labelSheetsFor } from './sheets';

const IN = 25.4;

describe('label sheet presets', () => {
  it.each(LABEL_SHEETS.map((s) => [s.id, s] as const))('%s fits on its page and its grid is coherent', (_id, s) => {
    const paper = PAPER_MM[s.paper];
    const right = s.marginLeftMm + (s.cols - 1) * s.pitchXMm + s.labelWidthMm;
    const bottom = s.marginTopMm + (s.rows - 1) * s.pitchYMm + s.labelHeightMm;
    expect(right).toBeLessThanOrEqual(paper.widthMm + 1e-6);
    expect(bottom).toBeLessThanOrEqual(paper.heightMm + 1e-6);
    expect(s.pitchXMm).toBeGreaterThanOrEqual(s.labelWidthMm - 1e-9); // labels never overlap
    expect(s.pitchYMm).toBeGreaterThanOrEqual(s.labelHeightMm - 1e-9);
  });

  it('5371 and 5395 are symmetric on the page (margins add up exactly), as published', () => {
    for (const id of ['avery-5371', 'avery-5395']) {
      const s = LABEL_SHEETS.find((x) => x.id === id)!;
      const rightMargin = PAPER_MM[s.paper].widthMm - (s.marginLeftMm + (s.cols - 1) * s.pitchXMm + s.labelWidthMm);
      expect(rightMargin, id).toBeCloseTo(s.marginLeftMm, 1);
      const bottomMargin = PAPER_MM[s.paper].heightMm - (s.marginTopMm + (s.rows - 1) * s.pitchYMm + s.labelHeightMm);
      expect(bottomMargin, id).toBeCloseTo(s.marginTopMm, 0); // 0.5467" vs the published 0.55"
    }
  });

  it('offers sheets only for the templates they are made for', () => {
    expect(labelSheetsFor('floppy').map((s) => s.id)).toEqual(['avery-5196']);
    expect(labelSheetsFor('nfc-card').map((s) => s.id)).toEqual(['avery-5395', 'avery-5371']);
    expect(labelSheetsFor('bluray')).toEqual([]);
    expect(LABEL_SHEETS.find((s) => s.id === 'avery-5196')!.verified).toBe(false);
  });
});

describe('imposeOnLabels', () => {
  it('floppy on 5196: 9 per sheet, art centred on each label, cropped to it, nothing lost', () => {
    const t = buildTemplate('floppy');
    const sheet = LABEL_SHEETS.find((s) => s.id === 'avery-5196')!;
    const layout = imposeOnLabels(sheet, t);
    expect(layout.placements).toHaveLength(9);
    expect(layout.labelRects).toHaveLength(9);
    const first = layout.placements[0];
    // No gap between labels, so the crop is exactly the label; the art's 1 mm bleed is cut off, its trim is intact.
    expect(first.xMm).toBeCloseTo(0.125 * IN);
    expect(first.yMm).toBeCloseTo(0.5 * IN);
    expect(first.crop!.widthMm).toBeCloseTo(69.85);
    expect(first.crop!.xMm).toBeCloseTo(t.bleedMm);
    expect(layout.warnings?.some((w) => w.includes('trimmed'))).toBe(false);
    expect(layout.warnings?.some((w) => w.includes('assumed'))).toBe(true); // 5196 is only partly verified
  });

  it('CR80 on 5395: 8 per sheet, fits entirely inside each label, bleed allowed into the gap', () => {
    const t = buildTemplate('nfc-card', 'cr80');
    const layout = imposeOnLabels(LABEL_SHEETS.find((s) => s.id === 'avery-5395')!, t);
    expect(layout.placements).toHaveLength(8);
    for (const p of layout.placements) {
      expect(p.rotated).toBe(true); // portrait art on landscape labels is turned
      expect(p.crop!.widthMm).toBeCloseTo(t.totalHeightMm); // the whole artwork fits (label is bigger than the card)
      expect(p.crop!.heightMm).toBeCloseTo(t.totalWidthMm);
    }
    expect(layout.warnings).toEqual([]);
  });

  it('CR80 on 5371: warns that a 2" card is shorter than a CR80', () => {
    const layout = imposeOnLabels(LABEL_SHEETS.find((s) => s.id === 'avery-5371')!, buildTemplate('nfc-card', 'cr80'));
    expect(layout.placements).toHaveLength(10);
    expect(layout.warnings![0]).toMatch(/trimmed by up to 1\.6 mm/);
  });

  it('never lets adjacent printed areas overlap', () => {
    for (const [kind, id, sheetId] of [['floppy', undefined, 'avery-5196'], ['nfc-card', 'cr80', 'avery-5395'], ['nfc-card', 'cr80', 'avery-5371']] as const) {
      const layout = imposeOnLabels(LABEL_SHEETS.find((s) => s.id === sheetId)!, buildTemplate(kind, id));
      for (const [i, a] of layout.placements.entries()) {
        for (const b of layout.placements.slice(i + 1)) {
          const ox = Math.min(a.xMm + a.crop!.widthMm, b.xMm + b.crop!.widthMm) - Math.max(a.xMm, b.xMm);
          const oy = Math.min(a.yMm + a.crop!.heightMm, b.yMm + b.crop!.heightMm) - Math.max(a.yMm, b.yMm);
          expect(ox > 1e-6 && oy > 1e-6, `${sheetId} ${i}`).toBe(false);
        }
      }
    }
  });
});

describe('computeLayout', () => {
  it('uses the die-cut sheet when it applies, and falls back to auto multi-up otherwise', () => {
    const floppy = buildTemplate('floppy');
    expect(computeLayout(floppy, 'A4', 'avery-5196').labelRects).toHaveLength(9);
    expect(computeLayout(floppy, 'A4').labelRects).toBeUndefined();
    // A sheet for a different template is ignored rather than mis-applied.
    expect(computeLayout(buildTemplate('bluray', 'us-11'), 'A4', 'avery-5196').labelRects).toBeUndefined();
  });

  it('auto multi-up packs small labels onto plain paper', () => {
    expect(computeLayout(buildTemplate('nfc-card', 'cr80'), 'A4').placements.length).toBeGreaterThanOrEqual(10);
  });
});
