import { describe, expect, it } from 'vitest';
import { drawBorder } from './border';
import { DEFAULT_BORDER } from '../types/editor';
import type { PanelRect } from '../types/template';

interface FakeCtx {
  calls: string[];
  save(): void;
  restore(): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  strokeStyle: string;
  lineWidth: number;
}

function fakeCtx(): FakeCtx {
  const calls: string[] = [];
  return {
    calls,
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    strokeRect: (x, y, w, h) => calls.push(`strokeRect ${x},${y},${w},${h}`),
    set strokeStyle(v: string) {
      calls.push(`strokeStyle ${v}`);
    },
    get strokeStyle() {
      return '';
    },
    set lineWidth(v: number) {
      calls.push(`lineWidth ${v}`);
    },
    get lineWidth() {
      return 0;
    },
  };
}

const panel: PanelRect = { id: 'front', label: 'Front', xMm: 10, yMm: 20, widthMm: 100, heightMm: 50 };

describe('drawBorder', () => {
  it('does nothing at the default (zero width)', () => {
    const ctx = fakeCtx();
    drawBorder(ctx as unknown as CanvasRenderingContext2D, panel, DEFAULT_BORDER, 10);
    expect(ctx.calls).toEqual([]);
  });

  it('strokes a rect inset from the trim edge by insetMm plus half the line width', () => {
    const ctx = fakeCtx();
    drawBorder(ctx as unknown as CanvasRenderingContext2D, panel, { color: '#ff0000', widthMm: 2, insetMm: 3 }, 10);
    // inset = 3 + 1 = 4mm; rect = (10+4, 20+4, 100-8, 50-8) * 10px/mm
    expect(ctx.calls).toContain('strokeRect 140,240,920,420');
    expect(ctx.calls).toContain('strokeStyle #ff0000');
    expect(ctx.calls).toContain('lineWidth 20');
  });

  it('is skipped once the inset would collapse the rect (a tiny panel or a huge border)', () => {
    const ctx = fakeCtx();
    drawBorder(ctx as unknown as CanvasRenderingContext2D, panel, { color: '#000', widthMm: 2, insetMm: 30 }, 10);
    expect(ctx.calls).toEqual([]);
  });
});
