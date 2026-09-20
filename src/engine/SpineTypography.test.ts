import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { MAX_AUTO_CAP_MM, TYPICAL_LONG_TITLE_CHARS, defaultCapHeightMm } from './SpineTypography';

const spineOf = (kind: Parameters<typeof buildTemplate>[0], id: string) => {
  const p = buildTemplate(kind, id).panels.find((q) => q.text)!;
  return defaultCapHeightMm(p, p.text);
};

describe('default spine text height', () => {
  it('stays at the maximum on tall spines (DVD, Blu-ray, VHS box)', () => {
    expect(spineOf('dvd', 'std-14')).toBe(MAX_AUTO_CAP_MM);
    expect(spineOf('bluray', 'us-11')).toBe(MAX_AUTO_CAP_MM);
    expect(spineOf('vhs', 'std-25')).toBe(MAX_AUTO_CAP_MM);
  });

  it('shrinks on short spines so a long title fits on one line (CD, cassette, NFC box)', () => {
    for (const [kind, id] of [['cd', 'jewel'], ['cassette', 'std'], ['nfc-box', 'card']] as const) {
      const t = buildTemplate(kind, id);
      const p = t.panels.find((q) => q.text)!;
      const cap = defaultCapHeightMm(p, p.text);
      expect(cap, kind).toBeLessThan(MAX_AUTO_CAP_MM);
      // A long title's width at this size (0.6 em per character, cap height 0.72 em) fits the run minus margins.
      const run = (p.text === 'vertical' ? p.heightMm : p.widthMm) - 8;
      expect((TYPICAL_LONG_TITLE_CHARS * 0.6 * cap) / 0.72, kind).toBeLessThanOrEqual(run + 0.5);
    }
  });

  it('never exceeds 60% of the spine thickness', () => {
    expect(defaultCapHeightMm({ xMm: 0, yMm: 0, widthMm: 4, heightMm: 300 })).toBeCloseTo(2.4);
  });
});
