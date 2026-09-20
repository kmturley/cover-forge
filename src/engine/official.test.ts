import { describe, expect, it } from 'vitest';
import { TEMPLATE_DEFS, buildTemplate } from '../templates';
import { OFFICIAL_HEADERS, spineCapMm } from './official';

describe('official headers', () => {
  it('has a banner for every template kind', () => {
    for (const d of TEMPLATE_DEFS) expect(OFFICIAL_HEADERS[d.kind], d.kind).toBeDefined();
  });

  it.each(TEMPLATE_DEFS.map((d) => [d.kind] as const))('%s: banner and spine cap fit their panels', (kind) => {
    const t = buildTemplate(kind);
    const spec = OFFICIAL_HEADERS[kind];
    const front = t.panels.find((p) => p.id === 'front')!;
    expect(spec.heightMm).toBeLessThan(front.heightMm / 2);
    for (const p of t.panels.filter((q) => q.text)) {
      const run = p.text === 'vertical' ? p.heightMm : p.widthMm;
      expect(spec.capMm, `${kind} ${p.id}`).toBeLessThan(run / 2); // leaves most of the spine for the title
    }
    // Labels and cards have no spine, so no cap.
    if (!t.panels.some((p) => p.text)) expect(spec.capMm).toBe(0);
  });

  it('only reserves cap room when the Official style is on', () => {
    expect(spineCapMm('bluray', false)).toBe(0);
    expect(spineCapMm('bluray', true)).toBe(15);
  });
});
