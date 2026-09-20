import type { TemplateConfig } from '../types/template';
import type { Imposition } from './imposition';
import { placedGuides, placedMarks, type Segment } from './pdfExport';
import { cropCanvas, rotateClockwise } from './rasterExport';

const JPEG_QUALITY = 0.95;
const NS = 'xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"';

/** Anything that can produce an image data URL; a canvas in the browser, a stub in tests. */
type Pixels = Pick<HTMLCanvasElement, 'toDataURL'>;

const n = (v: number) => Number(v.toFixed(3));

function image(src: Pixels, x: number, y: number, w: number, h: number): string {
  const href = src.toDataURL('image/jpeg', JPEG_QUALITY);
  return `<image x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="none" xlink:href="${href}" href="${href}"/>`;
}

function lines(segments: Segment[]): string {
  return segments
    .map((s) => `<line x1="${n(s.x1)}" y1="${n(s.y1)}" x2="${n(s.x2)}" y2="${n(s.y2)}" stroke="${s.dashed ? '#22d3ee' : '#ff2d95'}" stroke-width="0.2"${s.dashed ? ' stroke-dasharray="2 1.5"' : ''}/>`)
    .join('');
}

function marks(t: TemplateConfig, x: number, y: number, rotated: boolean): string {
  return placedMarks(t, x, y, rotated)
    .map((m) => `<circle cx="${n(m.x)}" cy="${n(m.y)}" r="${n(m.r)}" fill="none" stroke="#f59e0b" stroke-width="0.2" stroke-dasharray="1.5 1"/><text x="${n(m.x)}" y="${n(m.y)}" font-size="2.6" font-family="Helvetica, Arial, sans-serif" font-weight="700" fill="#f59e0b" text-anchor="middle" dominant-baseline="middle">${m.label}</text>`)
    .join('');
}

/** The document: physical size in mm, with a viewBox in mm so 1 unit = 1 mm in any vector editor. */
function svg(widthMm: number, heightMm: number, body: string): Blob {
  const text = `<?xml version="1.0" encoding="UTF-8"?>\n<svg ${NS} width="${n(widthMm)}mm" height="${n(heightMm)}mm" viewBox="0 0 ${n(widthMm)} ${n(heightMm)}">${body}</svg>\n`;
  return new Blob([text], { type: 'image/svg+xml' });
}

/** One game's wrap at exactly its template size. `canvas` must be rendered without raster guides. */
export function buildItemSvg(canvas: Pixels, template: TemplateConfig, guides: boolean): Blob {
  const { totalWidthMm: w, totalHeightMm: h } = template;
  return svg(w, h, image(canvas, 0, 0, w, h) + (guides ? `<g>${lines(placedGuides(template, 0, 0, false))}${marks(template, 0, 0, false)}</g>` : ''));
}

/** One print sheet: the artwork at each placement plus (when wanted) true vector cut/fold lines. */
export function buildSheetSvg(items: HTMLCanvasElement[], layout: Imposition, template: TemplateConfig, guides: boolean): Blob {
  const { widthMm: pw, heightMm: ph } = layout.paper;
  const parts = ['<rect width="100%" height="100%" fill="#ffffff"/>'];
  items.forEach((canvas, i) => {
    const p = layout.placements[i];
    if (!p) return;
    if (p.crop) {
      // Die-cut label sheet: only the label's part of the artwork, and no guides.
      parts.push(image(cropCanvas(p.rotated ? rotateClockwise(canvas) : canvas, p.crop, template.dpiScale), p.xMm, p.yMm, p.crop.widthMm, p.crop.heightMm));
      return;
    }
    const src = p.rotated ? rotateClockwise(canvas) : canvas;
    const scale = layout.oversize ? Math.min(1, pw / layout.cellWidthMm, ph / layout.cellHeightMm) : 1;
    const w = layout.cellWidthMm * scale;
    const h = layout.cellHeightMm * scale;
    const x = layout.oversize ? (pw - w) / 2 : p.xMm;
    const y = layout.oversize ? (ph - h) / 2 : p.yMm;
    parts.push(image(src, x, y, w, h));
    if (guides && !layout.oversize) parts.push(`<g>${lines(placedGuides(template, p.xMm, p.yMm, p.rotated))}${marks(template, p.xMm, p.yMm, p.rotated)}</g>`);
  });
  return svg(pw, ph, parts.join(''));
}
