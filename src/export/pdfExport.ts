import { jsPDF } from 'jspdf';
import type { TemplateConfig } from '../types/template';
import type { Imposition } from './imposition';
import { rotateClockwise } from './rasterExport';

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
}

const JPEG_QUALITY = 0.95;

/** Trim rectangle and panel fold lines in item-local mm. */
export function guideSegments(t: TemplateConfig): Segment[] {
  const b = t.bleedMm;
  const [x0, y0, x1, y1] = [b, b, b + t.trimWidthMm, b + t.trimHeightMm];
  const segs: Segment[] = [
    { x1: x0, y1: y0, x2: x1, y2: y0, dashed: false },
    { x1: x1, y1: y0, x2: x1, y2: y1, dashed: false },
    { x1: x1, y1: y1, x2: x0, y2: y1, dashed: false },
    { x1: x0, y1: y1, x2: x0, y2: y0, dashed: false },
  ];
  for (const p of t.panels.slice(1)) segs.push({ x1: p.xMm, y1: y0, x2: p.xMm, y2: y1, dashed: true });
  return segs;
}

/** Maps an item-local point to sheet coordinates for a placement (90° CW when rotated). */
function toSheet(x: number, y: number, itemH: number, px: number, py: number, rotated: boolean): [number, number] {
  return rotated ? [px + (itemH - y), py + x] : [px + x, py + y];
}

/** Vector cut (solid) and fold (dashed) lines for one item placed at (px, py) mm. */
function drawVectorGuides(pdf: jsPDF, t: TemplateConfig, px: number, py: number, rotated: boolean): void {
  pdf.setLineWidth(0.2);
  for (const s of guideSegments(t)) {
    const [ax, ay] = toSheet(s.x1, s.y1, t.totalHeightMm, px, py, rotated);
    const [bx, by] = toSheet(s.x2, s.y2, t.totalHeightMm, px, py, rotated);
    pdf.setDrawColor(s.dashed ? '#22d3ee' : '#ff2d95');
    pdf.setLineDashPattern(s.dashed ? [2, 1.5] : [], 0);
    pdf.line(ax, ay, bx, by);
  }
  pdf.setLineDashPattern([], 0);
}

const orientation = (w: number, h: number) => (w > h ? 'landscape' : 'portrait');

/**
 * One game's wrap as a PDF whose page is exactly the template size (bleed included).
 * `canvas` must be rendered WITHOUT guides; guides are added as vector lines only when `guides` is true.
 */
export function buildItemPdf(canvas: HTMLCanvasElement, template: TemplateConfig, guides: boolean): Blob {
  const { totalWidthMm: w, totalHeightMm: h } = template;
  const pdf = new jsPDF({ unit: 'mm', format: [w, h], orientation: orientation(w, h), compress: true });
  pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, w, h, undefined, 'FAST');
  if (guides) drawVectorGuides(pdf, template, 0, 0, false);
  return pdf.output('blob');
}

/**
 * All sheets as one multi-page PDF at exact paper size: raster artwork plus true vector guides.
 * `pages` holds each sheet's item canvases, rendered WITHOUT guides.
 */
export function buildSheetsPdf(
  pages: HTMLCanvasElement[][],
  layout: Imposition,
  template: TemplateConfig,
  guides: boolean,
): Blob {
  const { widthMm: pw, heightMm: ph } = layout.paper;
  const pdf = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: orientation(pw, ph), compress: true });

  pages.forEach((items, pageIdx) => {
    if (pageIdx > 0) pdf.addPage([pw, ph], orientation(pw, ph));
    items.forEach((canvas, i) => {
      const p = layout.placements[i];
      if (!p) return;
      const src = p.rotated ? rotateClockwise(canvas) : canvas;
      const scale = layout.oversize ? Math.min(1, pw / layout.cellWidthMm, ph / layout.cellHeightMm) : 1;
      const w = layout.cellWidthMm * scale;
      const h = layout.cellHeightMm * scale;
      const x = layout.oversize ? (pw - w) / 2 : p.xMm;
      const y = layout.oversize ? (ph - h) / 2 : p.yMm;
      pdf.addImage(src.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', x, y, w, h, undefined, 'FAST');
      if (guides && !layout.oversize) drawVectorGuides(pdf, template, p.xMm, p.yMm, p.rotated);
    });
  });
  return pdf.output('blob');
}
