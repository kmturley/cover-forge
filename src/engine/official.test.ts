import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, buildTemplate } from '../templates';
import { FORMAT_BRANDING, GAME_CASE_BRANDING, arc, brandingFor, contrast, ease, slope, spineTitleCase, spineTitleColor, spineTitleStartMm, type FrontHeader } from './official';

const variantsOf = (kind: (typeof TEMPLATE_DEFS)[number]['kind']) => (kind === 'game-case' ? Object.keys(GAME_CASE_BRANDING) : [undefined]);

/** The header's deepest point, as a fraction of H. */
function deepest(f: FrontHeader): number {
  if (f.shape === 'band') return Math.max(...Array.from({ length: 21 }, (_, i) => f.depth(i / 20) + (f.line?.size ?? 0)));
  if (f.shape === 'tab') return f.h;
  return 0;
}

describe('branding', () => {
  it('only continues a band across the back when the front is a band', () => {
    for (const [kind, b] of Object.entries(FORMAT_BRANDING)) if (b.backBand) expect(b.front.shape, kind).toBe('band');
  });

  it('has branding for every template kind and every game case', () => {
    for (const d of TEMPLATE_DEFS) expect(FORMAT_BRANDING[d.kind], d.kind).toBeDefined();
    const cases = TEMPLATE_DEFS.find((d) => d.kind === 'game-case')!.variants.map((v) => v.id);
    for (const id of cases) expect(GAME_CASE_BRANDING[id], id).toBeDefined();
  });

  it.each(TEMPLATE_DEFS.map((d) => [d.kind] as const))('%s: headers and spine caps stay within their panels', (kind) => {
    for (const variantId of variantsOf(kind)) {
      const t = buildTemplate(kind, variantId);
      const b = brandingFor(kind, t.variantId);
      const name = `${kind}/${t.variantId}`;
      expect(deepest(b.front), name).toBeLessThan(0.25);
      if (b.front.shape === 'strip') expect(b.front.w, name).toBeLessThan(0.25);
      for (const m of b.spine?.marks ?? []) {
        expect(m.from, name).toBeGreaterThanOrEqual(0);
        expect(m.to, name).toBeGreaterThan(m.from);
      }
      for (const p of t.panels.filter((q) => q.text)) {
        expect(spineTitleStartMm(kind, t.variantId, true, p.heightMm), `${name} ${p.id}`).toBeLessThan(p.heightMm / 2);
      }
    }
  });

  it('only leaves room for the cap when Branded is on', () => {
    expect(spineTitleStartMm('bluray', 'us-11', false, 148)).toBe(0);
    expect(spineTitleStartMm('bluray', 'us-11', true, 148)).toBeCloseTo(0.1 * 148);
    // PS4 caps the top 22.8% of the spine; the title starts past it.
    expect(spineTitleStartMm('game-case', 'ps4', true, 160)).toBeCloseTo(0.2477 * 160);
    // Switch spines are red along their length; the title starts under the icon.
    expect(spineTitleStartMm('game-case', 'switch', true, 161)).toBeCloseTo(0.08 * 161);
  });

  it('follows the measured header shapes', () => {
    const band = (id: string) => GAME_CASE_BRANDING[id].front as Extract<FrontHeader, { shape: 'band' }>;
    expect(band('ps4').depth(0.5)).toBeCloseTo(0.108);
    expect(band('ps5').line).toEqual({ color: '#094695', size: 0.0047 });
    // GameCube: a convex arc, deeper in the middle than at the sides (measured on the fan template).
    expect(band('gamecube').depth(0)).toBeCloseTo(0.0575);
    expect(band('gamecube').depth(0.5)).toBeCloseTo(0.1055);
    expect(band('gamecube').depth(1)).toBeCloseTo(0.0575);
    // Wii: shallow across the left half, an S down to a deep plateau on the right (measured on the fan template).
    expect(band('wii').depth(0.3)).toBeCloseTo(0.024, 2);
    expect(band('wii').depth(0.7)).toBeCloseTo(0.1, 2);
    expect(band('wii').depth(0.9)).toBeCloseTo(0.1255, 3);
    // Wii: the header's top corner next to the spine is rounded, so it starts deeper than the shallow stretch.
    expect(band('wii').depth(0)).toBeGreaterThan(band('wii').depth(0.1));
    expect(band('switch2').fill).toBe('#f20c0d');
    expect(band('xbox-one').marks[0].align).toBe('center');
    expect(GAME_CASE_BRANDING.switch.front).toMatchObject({ shape: 'tab', w: 0.22, h: 0.132 });
    expect(GAME_CASE_BRANDING.ps1.front).toMatchObject({ shape: 'strip', w: 0.155 });
    expect(FORMAT_BRANDING.dvd.front.shape).toBe('none');
  });

  it('holds a slope at its end values outside its points', () => {
    const s = slope([[0.2, 0.1], [0.5, 0.3]]);
    expect(s(0)).toBe(0.1);
    expect(s(0.9)).toBe(0.3);
  });

  it('draws curved and sloped lower edges', () => {
    expect(arc(0.035, 0.095)(0)).toBeCloseTo(0.035);
    expect(arc(0.035, 0.095)(0.5)).toBeCloseTo(0.095);
    expect(arc(0.035, 0.095)(1)).toBeCloseTo(0.035);
    expect(ease(0.017, 0.122)(0)).toBeCloseTo(0.017);
    expect(ease(0.017, 0.122)(1)).toBeCloseTo(0.122);
    const s = slope([[0, 0.1], [0.5, 0.1], [1, 0.05]]);
    expect(s(0.25)).toBeCloseTo(0.1);
    expect(s(0.75)).toBeCloseTo(0.075);
  });
});

describe('spine title colour', () => {
  it('keeps the chosen colour unless it would vanish on a Branded spine', () => {
    expect(spineTitleColor('game-case', 'wii', true, '#ffffff')).toBe('#333333');
    expect(spineTitleColor('game-case', 'wii', true, '#cc0000')).toBe('#cc0000');
    expect(spineTitleColor('game-case', 'wii', false, '#ffffff')).toBe('#ffffff');
    expect(spineTitleColor('game-case', 'switch', true, '#ffffff')).toBe('#ffffff');
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21);
  });
});

describe('spine title case', () => {
  it('forces PS1 spine titles to caps only when Branded', () => {
    expect(spineTitleCase('game-case', 'ps1', true, 'Crash Bandicoot')).toBe('CRASH BANDICOOT');
    expect(spineTitleCase('game-case', 'ps1', false, 'Crash Bandicoot')).toBe('Crash Bandicoot');
    expect(spineTitleCase('game-case', 'ps4', true, 'Crash Bandicoot')).toBe('Crash Bandicoot');
  });
});
