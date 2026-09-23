import { describe, expect, it } from 'vitest';
import { buildTemplate } from '../templates';
import { MAX_AUTO_CAP_MM, TYPICAL_LONG_TITLE_CHARS, defaultCapHeightMm } from './SpineTypography';

const spineOf = (kind: Parameters<typeof buildTemplate>[0], id: string) => {
  const p = buildTemplate(kind, id).panels.find((q) => q.text)!;
  return defaultCapHeightMm(p, p.text);
};

describe('default spine text height', () => {
  it('stays at or near the maximum on tall spines (DVD, Blu-ray, VHS box)', () => {
    expect(spineOf('dvd', 'std-14')).toBe(MAX_AUTO_CAP_MM);
    expect(spineOf('bluray', 'us-11')).toBeGreaterThanOrEqual(3.5);
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

  it('never exceeds 40% of the spine thickness', () => {
    expect(defaultCapHeightMm({ xMm: 0, yMm: 0, widthMm: 4, heightMm: 300 })).toBeCloseTo(1.6);
  });
});

interface FakeCtx {
  calls: string[];
  save(): void;
  restore(): void;
  measureText(t: string): { width: number };
  translate(x: number, y: number): void;
  rotate(rad: number): void;
  fillText(t: string, x: number, y: number): void;
  fillStyle: string;
  textAlign: string;
  textBaseline: string;
  font: string;
}

function fakeCtx(): FakeCtx {
  const calls: string[] = [];
  return {
    calls,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    measureText: () => ({ width: 10 }),
    translate: (x, y) => calls.push(`translate ${x},${y}`),
    rotate: (r) => calls.push(`rotate ${r.toFixed(4)}`),
    fillText: (t, x, y) => calls.push(`fillText ${t} ${x},${y}`),
    set fillStyle(_v: string) {},
    get fillStyle() {
      return '';
    },
    set textAlign(_v: string) {},
    get textAlign() {
      return '';
    },
    set textBaseline(_v: string) {},
    get textBaseline() {
      return '';
    },
    set font(_v: string) {},
    get font() {
      return '';
    },
  };
}

describe('spine text rotation', () => {
  const box = { xMm: 0, yMm: 0, widthMm: 12, heightMm: 148 };
  const base = { fontFamily: 'Helvetica', color: '#fff' };

  it('rotates 90° for a vertical spine and no further by default', async () => {
    const { drawSpineText } = await import('./SpineTypography');
    const ctx = fakeCtx();
    drawSpineText(ctx as unknown as CanvasRenderingContext2D, box, 'Title', base, 10);
    expect(ctx.calls.filter((c) => c.startsWith('rotate'))).toEqual([`rotate ${(Math.PI / 2).toFixed(4)}`]);
  });

  it('adds the extra rotation on top of the base orientation when set', async () => {
    const { drawSpineText } = await import('./SpineTypography');
    const ctx = fakeCtx();
    drawSpineText(ctx as unknown as CanvasRenderingContext2D, box, 'Title', { ...base, rotationDeg: 180 }, 10);
    expect(ctx.calls.filter((c) => c.startsWith('rotate'))).toEqual([`rotate ${(Math.PI / 2).toFixed(4)}`, `rotate ${Math.PI.toFixed(4)}`]);
  });

  it('applies the extra rotation on a horizontal spine too, with no base rotation call', async () => {
    const { drawSpineText } = await import('./SpineTypography');
    const ctx = fakeCtx();
    drawSpineText(ctx as unknown as CanvasRenderingContext2D, { xMm: 0, yMm: 0, widthMm: 101.6, heightMm: 12.7 }, 'Title', { ...base, rotationDeg: 90 }, 10, 'horizontal');
    expect(ctx.calls.filter((c) => c.startsWith('rotate'))).toEqual([`rotate ${(Math.PI / 2).toFixed(4)}`]);
  });
});
