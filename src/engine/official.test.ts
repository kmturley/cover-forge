import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, buildTemplate } from '../templates';
import { GAME_CASE_HEADERS, OFFICIAL_HEADERS, resolveHeader, spineCapMm } from './official';

describe('official headers', () => {
  it('has a banner for every template kind', () => {
    for (const d of TEMPLATE_DEFS) expect(OFFICIAL_HEADERS[d.kind], d.kind).toBeDefined();
  });

  it.each(TEMPLATE_DEFS.map((d) => [d.kind] as const))('%s: banner and spine cap fit their panels', (kind) => {
    const variants = kind === 'game-case' ? Object.keys(GAME_CASE_HEADERS) : [undefined];
    for (const variantId of variants) {
      const t = buildTemplate(kind, variantId);
      const spec = resolveHeader(kind, t.variantId);
      const front = t.panels.find((p) => p.id === 'front')!;
      expect(spec.heightMm).toBeLessThan(front.heightMm / 2);
      for (const p of t.panels.filter((q) => q.text)) {
        const run = p.text === 'vertical' ? p.heightMm : p.widthMm;
        expect(spec.capMm, `${kind}/${t.variantId} ${p.id}`).toBeLessThan(run / 2);
      }
      if (!t.panels.some((p) => p.text)) expect(spec.capMm).toBe(0);
    }
  });

  it('only reserves cap room when the Official style is on', () => {
    expect(spineCapMm('bluray', false)).toBe(0);
    expect(spineCapMm('bluray', true)).toBe(15);
    expect(spineCapMm('game-case', true, 'ps4')).toBe(14);
    expect(spineCapMm('game-case', true, 'switch')).toBe(12);
  });
});
