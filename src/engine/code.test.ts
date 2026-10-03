import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { DEFAULT_CODE, type CodeSettings } from '../types/editor';
import { CODE_SAFETY_MM, computeCodePlacement } from './code';

/** Settings as an older save stored them: mm fields, no box. */
const legacy = (o: Partial<CodeSettings>): CodeSettings => {
  const { box: _box, ...rest } = DEFAULT_CODE;
  void _box;
  return { ...rest, ...o } as CodeSettings;
};

const t = buildTemplate('bluray', 'us-11');
const panel = (id: 'front' | 'spine' | 'back') => t.panels.find((p) => p.id === id)!;

describe('computeCodePlacement', () => {
  it('draws nothing for kind "none"', () => {
    expect(computeCodePlacement(t, panel('front'), DEFAULT_CODE)).toBeNull();
  });

  it('sizes each kind sensibly and sits at the bottom-right by default', () => {
    const qr = computeCodePlacement(t, panel('back'), { ...DEFAULT_CODE, kind: 'qr' })!;
    expect(qr.widthMm).toBe(30);
    expect(qr.heightMm).toBe(30);
    expect(qr.fits).toBe(true);
    const right = qr.area.xMm + qr.xMm + qr.widthMm;
    const bottom = qr.area.yMm + qr.yMm + qr.heightMm;
    expect(right).toBeCloseTo(panel('back').xMm + panel('back').widthMm - 8);
    expect(bottom).toBeCloseTo(panel('back').yMm + panel('back').heightMm - 8);
    const ean = computeCodePlacement(t, panel('back'), { ...DEFAULT_CODE, kind: 'ean13' })!;
    // Shorter than the full GS1 symbol (about 13 mm of bars), set in a little white margin.
    expect(ean.widthMm).toBeCloseTo(37.29 + 3);
    expect(ean.heightMm).toBeLessThan(20);
    expect(ean.widthMm / ean.heightMm).toBeGreaterThan(2);
  });

  it('omits a code with too little room to scan (e.g. a QR code on an 11 mm spine)', () => {
    expect(computeCodePlacement(t, panel('spine'), { ...DEFAULT_CODE, kind: 'qr' })!.fits).toBe(false);
    // An older save's 4 mm QR code still fits the 5 mm safe width, as it did.
    expect(computeCodePlacement(t, panel('spine'), legacy({ kind: 'qr', widthMm: 4 }))!.fits).toBe(true);
    expect(computeCodePlacement(t, panel('spine'), legacy({ kind: 'qr', widthMm: 6 }))!.fits).toBe(false);
  });

  it('sizes a code to fit inside its box and the safe area, keeping its proportions', () => {
    const back = panel('back');
    const qr = computeCodePlacement(t, back, { ...DEFAULT_CODE, kind: 'qr', box: { xStart: 0, xEnd: 50, yStart: 0, yEnd: 100 } })!;
    // Half the panel wide, less the 3 mm safety margin it can't enter.
    expect(qr.widthMm).toBeCloseTo(back.widthMm / 2 - CODE_SAFETY_MM);
    expect(qr.heightMm).toBeCloseTo(qr.widthMm);
    expect(qr.fits).toBe(true);
    const tiny = computeCodePlacement(t, back, { ...DEFAULT_CODE, kind: 'ean13', box: { xStart: 40, xEnd: 50, yStart: 40, yEnd: 50 } })!;
    expect(tiny.fits).toBe(false); // ~13 mm wide: too small for a barcode to scan
  });

  it('an older save: uses its mm position from the panel paint-area corner', () => {
    const pl = computeCodePlacement(t, panel('back'), legacy({ kind: 'qr', xMm: 20, yMm: 30 }))!;
    expect(pl.xMm).toBe(20);
    expect(pl.yMm).toBe(30);
  });

  it('keeps a code whole inside the safe area, wherever its box or an older mm position says', () => {
    const back = panel('back');
    const boxes = [{ xStart: -50, xEnd: 20, yStart: -50, yEnd: 20 }, { xStart: 80, xEnd: 150, yStart: 80, yEnd: 150 }];
    const settings = [...[[0, 0], [500, 500], [-50, 40]].map(([xMm, yMm]) => legacy({ kind: 'qr', xMm, yMm })), ...boxes.map((box) => ({ ...DEFAULT_CODE, kind: 'qr' as const, box }))];
    for (const code of settings) {
      const pl = computeCodePlacement(t, back, code)!;
      const [left, top] = [pl.area.xMm + pl.xMm, pl.area.yMm + pl.yMm];
      expect(left).toBeGreaterThanOrEqual(back.xMm + CODE_SAFETY_MM - 1e-9);
      expect(top).toBeGreaterThanOrEqual(back.yMm + CODE_SAFETY_MM - 1e-9);
      expect(left + pl.widthMm).toBeLessThanOrEqual(back.xMm + back.widthMm - CODE_SAFETY_MM + 1e-9);
      expect(top + pl.heightMm).toBeLessThanOrEqual(back.yMm + back.heightMm - CODE_SAFETY_MM + 1e-9);
    }
  });
});
