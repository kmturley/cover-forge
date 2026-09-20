import { jsPDF } from 'jspdf';
import type { TemplateConfig } from '../types/template';
import { edgeSegments } from '../templates/geometry';
import type { Imposition } from './imposition';
import { cropCanvas, rotateClockwise } from './rasterExport';

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  dashed: boolean;
}

const JPEG_QUALITY = 0.95;

/** Cut (solid) and fold (dashed) lines in item-local mm, derived from the template's panel edges. */
export function guideSegments(t: TemplateConfig): Segment[] {
  return edgeSegments(t).map((s) => ({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, dashed: s.kind === 'fold' }));
}

/** Maps an item-local point to sheet coordinates for a placement (90° CW when rotated). */
function toSheet(x: number, y: number, itemH: number, px: number, py: number, rotated: boolean): [number, number] {
  return rotated ? [px + (itemH - y), py + x] : [px + x, py + y];
}

/** The template's cut/fold lines positioned on a sheet for an item placed at (px, py) mm (90° CW when rotated). */
export function placedGuides(t: TemplateConfig, px: number, py: number, rotated: boolean): Segment[] {
  return guideSegments(t).map((s) => {
    const [x1, y1] = toSheet(s.x1, s.y1, t.totalHeightMm, px, py, rotated);
    const [x2, y2] = toSheet(s.x2, s.y2, t.totalHeightMm, px, py, rotated);
    return { x1, y1, x2, y2, dashed: s.dashed };
  });
}

export type { Segment };

export interface PlacedMark {
  x: number;
  y: number;
  r: number;
  label: string;
}

/** The template's guide marks positioned on a sheet for an item placed at (px, py) mm. */
export function placedMarks(t: TemplateConfig, px: number, py: number, rotated: boolean): PlacedMark[] {
  return (t.marks ?? []).map((m) => {
    const [x, y] = toSheet(m.xMm, m.yMm, t.totalHeightMm, px, py, rotated);
    return { x, y, r: m.diameterMm / 2, label: m.label };
  });
}

/** Vector cut (solid) and fold (dashed) lines for one item placed at (px, py) mm. */
function drawVectorGuides(pdf: jsPDF, t: TemplateConfig, px: number, py: number, rotated: boolean): void {
  pdf.setLineWidth(0.2);
  for (const s of placedGuides(t, px, py, rotated)) {
    pdf.setDrawColor(s.dashed ? '#22d3ee' : '#ff2d95');
    pdf.setLineDashPattern(s.dashed ? [2, 1.5] : [], 0);
    pdf.line(s.x1, s.y1, s.x2, s.y2);
  }
  pdf.setDrawColor('#f59e0b');
  pdf.setTextColor('#f59e0b');
  pdf.setLineDashPattern([1.5, 1], 0);
  pdf.setFontSize(7);
  for (const m of placedMarks(t, px, py, rotated)) {
    pdf.circle(m.x, m.y, m.r, 'S');
    pdf.text(m.label, m.x, m.y, { align: 'center', baseline: 'middle' });
  }
  pdf.setLineDashPattern([], 0);
  pdf.setTextColor('#000000');
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
      if (p.crop) {
        // Die-cut label sheet: print only the label's part of the artwork (after any turn), with no cut/fold guides.
        const part = cropCanvas(p.rotated ? rotateClockwise(canvas) : canvas, p.crop, template.dpiScale);
        pdf.addImage(part.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', p.xMm, p.yMm, p.crop.widthMm, p.crop.heightMm, undefined, 'FAST');
        return;
      }
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
