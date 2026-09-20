import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { DEFAULT_CODE } from '../types/editor';
import { computeCodePlacement } from './code';

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
    expect(ean.widthMm / ean.heightMm).toBeCloseTo(37.29 / 25.93);
  });

  it('omits a code that does not fit inside the safe area (e.g. a QR code on an 11 mm spine)', () => {
    expect(computeCodePlacement(t, panel('spine'), { ...DEFAULT_CODE, kind: 'qr' })!.fits).toBe(false);
    expect(computeCodePlacement(t, panel('spine'), { ...DEFAULT_CODE, kind: 'qr', widthMm: 4 })!.fits).toBe(true); // 4 + 2×3 ≤ 11
    expect(computeCodePlacement(t, panel('spine'), { ...DEFAULT_CODE, kind: 'qr', widthMm: 6 })!.fits).toBe(false);
  });

  it('a 35 mm QR code fits a Blu-ray panel but not a CR80 card or a J-card spine', () => {
    const qr35 = { ...DEFAULT_CODE, kind: 'qr' as const, widthMm: 35 };
    expect(computeCodePlacement(t, panel('front'), qr35)!.fits).toBe(true);
    const card = buildTemplate('nfc-card');
    expect(computeCodePlacement(card, card.panels[0], qr35)!.fits).toBe(true); // 41 ≤ 54
    const tape = buildTemplate('cassette');
    expect(computeCodePlacement(tape, tape.panels.find((p) => p.id === 'spine')!, qr35)!.fits).toBe(false); // spine is 12 mm tall
  });

  it('uses explicit positions from the panel paint-area corner', () => {
    const pl = computeCodePlacement(t, panel('back'), { ...DEFAULT_CODE, kind: 'qr', xMm: 0, yMm: 0 })!;
    expect(pl.area.xMm + pl.xMm).toBe(0);
    expect(pl.area.yMm + pl.yMm).toBe(0);
  });
});
