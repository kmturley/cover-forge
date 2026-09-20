import type { PanelRect, TemplateConfig } from '../types/template';

const EPS = 1e-6;

export type Side = 'top' | 'right' | 'bottom' | 'left';

/** Overlap length of two 1-D spans. */
const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.min(a1, b1) - Math.max(a0, b0);

/** The panel touching `p` along `side`, if any. Panels that merely touch at a corner don't count. */
export function neighbour(panels: PanelRect[], p: PanelRect, side: Side): PanelRect | undefined {
  return panels.find((q) => {
    if (q === p) return false;
    switch (side) {
      case 'right':
        return Math.abs(q.xMm - (p.xMm + p.widthMm)) < EPS && overlap(p.yMm, p.yMm + p.heightMm, q.yMm, q.yMm + q.heightMm) > EPS;
      case 'left':
        return Math.abs(q.xMm + q.widthMm - p.xMm) < EPS && overlap(p.yMm, p.yMm + p.heightMm, q.yMm, q.yMm + q.heightMm) > EPS;
      case 'bottom':
        return Math.abs(q.yMm - (p.yMm + p.heightMm)) < EPS && overlap(p.xMm, p.xMm + p.widthMm, q.xMm, q.xMm + q.widthMm) > EPS;
      case 'top':
        return Math.abs(q.yMm + q.heightMm - p.yMm) < EPS && overlap(p.xMm, p.xMm + p.widthMm, q.xMm, q.xMm + q.widthMm) > EPS;
    }
  });
}

/**
 * A panel's paint area: its trim rect, extended by the bleed on every side that is a cut edge
 * (i.e. that no other panel touches). Sides shared with a neighbour are folds and don't bleed.
 */
export function paintRect(t: TemplateConfig, p: PanelRect): PanelRect {
  const b = t.bleedMm;
  const left = neighbour(t.panels, p, 'left') ? 0 : b;
  const right = neighbour(t.panels, p, 'right') ? 0 : b;
  const top = neighbour(t.panels, p, 'top') ? 0 : b;
  const bottom = neighbour(t.panels, p, 'bottom') ? 0 : b;
  return { ...p, xMm: p.xMm - left, yMm: p.yMm - top, widthMm: p.widthMm + left + right, heightMm: p.heightMm + top + bottom };
}

export interface EdgeSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** cut = outer edge (trim line); fold = shared with another panel. */
  kind: 'cut' | 'fold';
}

/** Trim (cut) and fold lines for the whole template, with each shared edge reported once. */
export function edgeSegments(t: TemplateConfig): EdgeSegment[] {
  const out: EdgeSegment[] = [];
  for (const p of t.panels) {
    const [x0, y0, x1, y1] = [p.xMm, p.yMm, p.xMm + p.widthMm, p.yMm + p.heightMm];
    const sides: [Side, EdgeSegment][] = [
      ['top', { x1: x0, y1: y0, x2: x1, y2: y0, kind: 'cut' }],
      ['right', { x1: x1, y1: y0, x2: x1, y2: y1, kind: 'cut' }],
      ['bottom', { x1: x0, y1: y1, x2: x1, y2: y1, kind: 'cut' }],
      ['left', { x1: x0, y1: y1, x2: x0, y2: y0, kind: 'cut' }],
    ];
    for (const [side, seg] of sides) {
      const n = neighbour(t.panels, p, side);
      if (!n) out.push(seg);
      else if (side === 'right') {
        // A shared edge is a fold; emit it once (from the right/bottom side) and only along the overlapping span.
        const [a, b] = [Math.max(y0, n.yMm), Math.min(y1, n.yMm + n.heightMm)];
        out.push({ x1: x1, y1: a, x2: x1, y2: b, kind: 'fold' });
      } else if (side === 'bottom') {
        const [a, b] = [Math.max(x0, n.xMm), Math.min(x1, n.xMm + n.widthMm)];
        out.push({ x1: a, y1: y1, x2: b, y2: y1, kind: 'fold' });
      }
    }
  }
  return out;
}
