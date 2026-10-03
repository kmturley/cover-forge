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
}

/**
 * Where an image sits in its panel. It is sized to its box (the whole panel, bleed included, by default) without
 * distortion: `fill` covers the box and is cropped to it, `fit` shows the whole image inside it. Centred either way.
 */
export function computePlacement(t: TemplateConfig, panel: PanelRect, naturalWidth: number, naturalHeight: number, tr: PanelTransform): Placement {
  const area = paintRect(t, panel);
  if (tr.box === undefined) return legacyPlacement(area, naturalWidth, naturalHeight, tr);
  const box = tr.box ? boxRect(panel, tr.box) : area;
  const fitted = tr.fit === 'fit';
  const img = (fitted ? fitInside : fillOver)(box, naturalWidth / naturalHeight);
  return {
    fit: img.widthMm / naturalWidth,
    widthMm: img.widthMm,
    heightMm: img.heightMm,
    xMm: img.xMm - area.xMm,
    yMm: img.yMm - area.yMm,
    area,
    box,
    clip: fitted ? area : intersect(box, area),
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
