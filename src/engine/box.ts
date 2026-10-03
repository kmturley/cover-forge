import type { PanelRect } from '../types/template';
import type { PanelBox } from '../types/editor';

/** A rectangle in canvas mm (the same frame as PanelRect: from the canvas's top-left). */
export interface RectMm {
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
}

/** Placement fields older saves stored, per layer kind (see LegacyPlacement). */
export const LEGACY_FIELDS = {
  transform: ['xMm', 'yMm', 'scale'],
  logo: ['xMm', 'yMm', 'widthMm'],
  code: ['xMm', 'yMm', 'widthMm'],
} as const;

/** The smallest a box may be on either axis, in percent, so it never collapses or turns inside out. */
export const MIN_BOX_PERCENT = 1;

/** A box that can be drawn: four finite numbers, each end past its start. Anything else (a corrupt save) is ignored. */
export function isBox(v: unknown): v is PanelBox {
  if (!v || typeof v !== 'object') return false;
  const b = v as Record<string, unknown>;
  const ok = (k: string) => typeof b[k] === 'number' && Number.isFinite(b[k]);
  return ok('xStart') && ok('xEnd') && ok('yStart') && ok('yEnd') && (b.xEnd as number) > (b.xStart as number) && (b.yEnd as number) > (b.yStart as number);
}

/** A box's rectangle on the canvas, from the panel it sits on. */
export function boxRect(panel: PanelRect, b: PanelBox): RectMm {
  return {
    xMm: panel.xMm + (b.xStart / 100) * panel.widthMm,
    yMm: panel.yMm + (b.yStart / 100) * panel.heightMm,
    widthMm: ((b.xEnd - b.xStart) / 100) * panel.widthMm,
    heightMm: ((b.yEnd - b.yStart) / 100) * panel.heightMm,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;

/** The box (in percent of the panel, to 0.01%) covering a canvas rectangle. */
export function rectToBox(panel: PanelRect, r: RectMm): PanelBox {
  return {
    xStart: round(((r.xMm - panel.xMm) / panel.widthMm) * 100),
    xEnd: round(((r.xMm + r.widthMm - panel.xMm) / panel.widthMm) * 100),
    yStart: round(((r.yMm - panel.yMm) / panel.heightMm) * 100),
    yEnd: round(((r.yMm + r.heightMm - panel.yMm) / panel.heightMm) * 100),
  };
}

/** The largest rectangle of `aspect` (width / height) inside `r`, centred: shown whole, never distorted. */
export function fitInside(r: RectMm, aspect: number): RectMm {
  const widthMm = Math.min(r.widthMm, r.heightMm * aspect);
  const heightMm = widthMm / aspect;
  return { xMm: r.xMm + (r.widthMm - widthMm) / 2, yMm: r.yMm + (r.heightMm - heightMm) / 2, widthMm, heightMm };
}

/** The smallest rectangle of `aspect` covering `r`, centred: fills it, overflowing on one axis, never distorted. */
export function fillOver(r: RectMm, aspect: number): RectMm {
  const widthMm = Math.max(r.widthMm, r.heightMm * aspect);
  const heightMm = widthMm / aspect;
  return { xMm: r.xMm + (r.widthMm - widthMm) / 2, yMm: r.yMm + (r.heightMm - heightMm) / 2, widthMm, heightMm };
}

/** Where two rectangles overlap (zero-sized if they don't). */
export function intersect(a: RectMm, b: RectMm): RectMm {
  const x0 = Math.max(a.xMm, b.xMm);
  const y0 = Math.max(a.yMm, b.yMm);
  const x1 = Math.min(a.xMm + a.widthMm, b.xMm + b.widthMm);
  const y1 = Math.min(a.yMm + a.heightMm, b.yMm + b.heightMm);
  return { xMm: x0, yMm: y0, widthMm: Math.max(0, x1 - x0), heightMm: Math.max(0, y1 - y0) };
}

/**
 * `upper` over `lower`, field by field, except for placement, which a layer sets as a whole: a layer that sets a
 * `box` (even `null`, "automatic") replaces everything below it about where the thing sits, so a box never mixes
 * with an older layer's mm fields. A layer that only has older mm fields keeps the field-by-field merge they always
 * had (so older saves render exactly as before), and hides any box below it. Undefined fields in `upper` are unset.
 */
export function overlayPlacement<T extends object>(lower: T | undefined, upper: Partial<T> | undefined, legacy: readonly string[]): T {
  const own = Object.fromEntries(Object.entries(upper ?? {}).filter(([, v]) => v !== undefined)) as Partial<T>;
  const out = { ...lower, ...own } as Record<string, unknown>;
  if ('box' in own) {
    for (const k of legacy) delete out[k];
  } else if (legacy.some((k) => k in own)) {
    delete out.box;
  }
  return out as T;
}
