import type { PanelRect, TemplateConfig } from '../types/template';
import { paintRect } from '../templates/geometry';
import type { PanelTransform } from '../types/editor';
import { boxRect, fillOver, fitInside, intersect, type RectMm } from './box';

export interface Placement {
  /** mm per source pixel. */
  fit: number;
  /** Displayed (unrotated) image size in mm. */
  widthMm: number;
  heightMm: number;
  /**
   * Image top-left relative to the panel's paint area top-left, in mm: the panel's visible corner on the canvas,
   * i.e. including bleed on edges that meet the page edge. Negative = starts left of / above it.
   */
  xMm: number;
  yMm: number;
  /** The panel's paint area (the reference for xMm/yMm). */
  area: PanelRect;
  /** The box the image is sized to, in canvas mm (for an older save's mm placement: the image itself). */
  box: RectMm;
  /** What the image is clipped to, in canvas mm: its box when it fills it, else the paint area. Never past the paint area. */
  clip: RectMm;
  /**
   * Set when the image fills the panel automatically: it is sized to the trimmed panel, and the bleed round it (the paint
   * area outside the trim) is filled by stretching the image's edges out (see draw.ts), since cover art has no bleed of its own.
   */
  extendEdges?: boolean;
}

/**
 * Where an image sits in its panel. It is sized to its box without distortion: `fill` covers the box and is cropped to it,
 * `fit` shows the whole image inside it. Centred either way. By default the box is the trimmed panel, so cover art (which
 * comes without bleed) is never cut into; a filling image then carries its edges out into the bleed.
 */
export function computePlacement(t: TemplateConfig, panel: PanelRect, naturalWidth: number, naturalHeight: number, tr: PanelTransform): Placement {
  const area = paintRect(t, panel);
  if (tr.box === undefined) return legacyPlacement(area, naturalWidth, naturalHeight, tr);
  const auto = tr.box === null;
  const box = tr.box ? boxRect(panel, tr.box) : { xMm: panel.xMm, yMm: panel.yMm, widthMm: panel.widthMm, heightMm: panel.heightMm };
  const fitted = tr.fit === 'fit';
  const img = fitted ? fitInside(box, naturalWidth / naturalHeight) : fillOver(box, naturalWidth / naturalHeight, tr.focus);
  const extendEdges = auto && !fitted;
  return {
    fit: img.widthMm / naturalWidth,
    widthMm: img.widthMm,
    heightMm: img.heightMm,
    xMm: img.xMm - area.xMm,
    yMm: img.yMm - area.yMm,
    area,
    box,
    clip: fitted || extendEdges ? area : intersect(box, area),
    ...(extendEdges && { extendEdges }),
  };
}

/**
 * An older save's placement (see LegacyPlacement): scale 1 covers the paint area, and `xMm`/`yMm` put the image's
 * top-left that far from the paint area's (centred when null). Kept so those saves render exactly as they did.
 */
function legacyPlacement(area: PanelRect, naturalWidth: number, naturalHeight: number, tr: PanelTransform): Placement {
  const fit = Math.max(area.widthMm / naturalWidth, area.heightMm / naturalHeight) * (tr.scale ?? 1);
  const widthMm = naturalWidth * fit;
  const heightMm = naturalHeight * fit;
  const xMm = tr.xMm ?? (area.widthMm - widthMm) / 2;
  const yMm = tr.yMm ?? (area.heightMm - heightMm) / 2;
  return { fit, widthMm, heightMm, xMm, yMm, area, box: { xMm: area.xMm + xMm, yMm: area.yMm + yMm, widthMm, heightMm }, clip: area };
}

export { paintRect };
