import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { DEFAULT_LOGO } from '../types/editor';
import { computeLogoPlacement } from './logo';

const t = buildTemplate('bluray', 'us-11');
const panel = (id: 'front' | 'spine' | 'back') => t.panels.find((p) => p.id === id)!;

describe('computeLogoPlacement', () => {
  it('centres horizontally on the trimmed panel and sits near the top by default', () => {
    const p = panel('front');
    const pl = computeLogoPlacement(t, p, 2, DEFAULT_LOGO);
    expect(pl.widthMm).toBe(24);
    expect(pl.heightMm).toBe(12);
    const centreX = pl.area.xMm + pl.xMm + pl.widthMm / 2;
    expect(centreX).toBeCloseTo(p.xMm + p.widthMm / 2);
    const top = pl.area.yMm + pl.yMm;
    expect(top).toBeCloseTo(p.yMm + 8); // 8 mm below the trim edge
  });

  it('sizes the spine logo from the spine width so it fits', () => {
    const pl = computeLogoPlacement(t, panel('spine'), 1, DEFAULT_LOGO);
    expect(pl.widthMm).toBeCloseTo(11 * 0.6);
    expect(pl.widthMm).toBeLessThan(panel('spine').widthMm);
  });

  it('uses explicit width and top-left position (from the paint-area corner) when set', () => {
    const pl = computeLogoPlacement(t, panel('back'), 1, { ...DEFAULT_LOGO, widthMm: 10, xMm: 0, yMm: 0 });
    expect(pl.widthMm).toBe(10);
    expect(pl.area.xMm + pl.xMm).toBe(0); // canvas left edge, bleed included
    expect(pl.area.yMm + pl.yMm).toBe(0); // canvas top edge
  });

  it('keeps the other axis at its default when only one is set', () => {
    const base = computeLogoPlacement(t, panel('front'), 2, DEFAULT_LOGO);
    const moved = computeLogoPlacement(t, panel('front'), 2, { ...DEFAULT_LOGO, xMm: 5 });
    expect(moved.xMm).toBe(5);
    expect(moved.yMm).toBe(base.yMm);
  });
});

describe('default logo size on small templates', () => {
  it('caps a spine mark at 10 mm and keeps marks on small panels modest', () => {
    const vhs = buildTemplate('vhs', 'std-25');
    const spine = computeLogoPlacement(vhs, vhs.panels.find((p) => p.id === 'spine')!, 1, DEFAULT_LOGO);
    expect(spine.widthMm).toBeLessThanOrEqual(10);
    const card = buildTemplate('nfc-card', 'cr80');
    expect(computeLogoPlacement(card, card.panels[0], 1, DEFAULT_LOGO).widthMm).toBeLessThan(24);
  });
});

describe('default spine logo size', () => {
  it('follows the automatic spine text, so a short spine (CD, cassette, NFC box) gets a small mark', () => {
    const width = (kind: Parameters<typeof buildTemplate>[0], id: string) => {
      const tpl = buildTemplate(kind, id);
      return computeLogoPlacement(tpl, tpl.panels.find((p) => p.text)!, 1, DEFAULT_LOGO).widthMm;
    };
    expect(width('cassette', 'std')).toBeLessThanOrEqual(5);
    expect(width('cd', 'jewel')).toBeLessThanOrEqual(5.5);
    expect(width('nfc-box', 'card')).toBeLessThanOrEqual(5);
    expect(width('dvd', 'std-14')).toBeGreaterThan(width('cassette', 'std'));
  });
});
