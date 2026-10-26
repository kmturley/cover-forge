import { describe, expect, it } from 'vitest';
import { cssFamily, fallbackFor, familyOf, fontUrl, nearestWeight, slug, subsetsFor } from './fontsource';
import { RECOMMENDED, SYSTEM_FONTS } from './recommended';
import { ensureFont, isSystemFont } from './loader';

describe('fontsource helpers', () => {
  it('makes Fontsource ids from family names', () => {
    expect(slug('Press Start 2P')).toBe('press-start-2p');
    expect(slug('DM Serif Display')).toBe('dm-serif-display');
    expect(slug(' Bebas  Neue ')).toBe('bebas-neue');
  });

  it('reads the first family out of a CSS value', () => {
    expect(familyOf('"Press Start 2P", sans-serif')).toBe('Press Start 2P');
    expect(familyOf("'Lobster', cursive")).toBe('Lobster');
    expect(familyOf('Helvetica, Arial, sans-serif')).toBe('Helvetica');
    expect(familyOf('')).toBe('');
  });

  it('stores a catalogue font with a fallback that suits its kind', () => {
    expect(cssFamily('Lora', 'serif')).toBe('"Lora", serif');
    expect(cssFamily('VT323', 'monospace')).toBe('"VT323", monospace');
    expect(cssFamily('Pacifico', 'handwriting')).toBe('"Pacifico", cursive');
    expect(fallbackFor('display')).toBe('sans-serif');
  });

  it('picks the nearest weight a font has, preferring the heavier on a tie', () => {
    expect(nearestWeight([400], 700)).toBe(400);
    expect(nearestWeight([300, 400, 700], 600)).toBe(700);
    expect(nearestWeight([400, 600], 500)).toBe(600);
    expect(nearestWeight([], 700)).toBe(700);
  });

  it('works out which extra character sets some text needs', () => {
    expect(subsetsFor('Smoke Test Quest')).toEqual([]);
    expect(subsetsFor('Żółć')).toContain('latin-ext');
    expect(subsetsFor('Привет')).toContain('cyrillic');
    expect(subsetsFor('Ελλάδα')).toContain('greek');
    expect(subsetsFor('Việt Nam')).toContain('vietnamese');
  });

  it('builds the CDN address of a font file', () => {
    expect(fontUrl('inter', 'latin', 400, 'normal')).toBe('https://cdn.jsdelivr.net/fontsource/fonts/inter@latest/latin-400-normal.woff2');
  });
});

describe('recommended fonts', () => {
  it('has unique ids whose names match the id scheme', () => {
    const all = RECOMMENDED.flatMap((g) => g.fonts);
    expect(new Set(all.map(([id]) => id)).size).toBe(all.length);
    for (const [id, name] of all) expect(slug(name), name).toBe(id);
    expect(all.length).toBeGreaterThanOrEqual(36);
  });
  it('keeps the system fonts apart', () => {
    expect(SYSTEM_FONTS.length).toBe(4);
    for (const [css] of SYSTEM_FONTS) expect(isSystemFont(css)).toBe(true);
    expect(isSystemFont('"Press Start 2P", sans-serif')).toBe(false);
  });
});

describe('ensureFont', () => {
  it('has nothing to load for system fonts, or where there is no page (a test)', async () => {
    expect(await ensureFont({ family: 'Helvetica, Arial, sans-serif', weight: 700, italic: false, text: 'x' })).toBe(true);
    expect(await ensureFont({ family: '"Lora", serif', weight: 400, italic: false, text: 'x' })).toBe(true);
  });
});
