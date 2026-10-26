import type { Fill, Gradient } from '../../types/layers';

export const isGradient = (f: Fill | null): f is Gradient => typeof f === 'object' && f !== null;

/** The canvas paint for a fill over the rectangle (x, y, w, h), in the canvas's own units: a colour, or a linear gradient across it. */
export function canvasPaint(ctx: CanvasRenderingContext2D, fill: Fill, x: number, y: number, w: number, h: number): string | CanvasGradient {
  if (!isGradient(fill)) return fill;
  const g = fill.axis === 'x' ? ctx.createLinearGradient(x, 0, x + w, 0) : ctx.createLinearGradient(0, y, 0, y + h);
  for (const [at, color] of fill.stops) g.addColorStop(Math.min(1, Math.max(0, at)), color);
  return g;
}

/** A readable name for a fill, for a list: the colour, or "gradient". */
export const fillLabel = (f: Fill | null): string => (f === null ? 'none' : isGradient(f) ? 'gradient' : f);
