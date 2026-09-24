import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { MediaItem } from '../types/media';
import { paginate } from './imposition';
import { computeLayout, fitsLabelSheet, getLabelSheet } from './sheets';
import { buildItemPdf, buildSheetsPdf } from './pdfExport';
import { buildItemSvg, buildSheetSvg } from './svgExport';
import {
  canvasToBlob,
  renderItemCanvas,
  renderSheetCanvas,
  type ExportSettings,
  type RasterFormat,
  type SceneBase,
} from './rasterExport';

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled';

const isPdf = (s: ExportSettings) => s.format === 'pdf';
const isSvg = (s: ExportSettings) => s.format === 'svg';
/** PDF and SVG carry their guides as vector lines, so their artwork is rendered without guides baked in. */
const isVector = (s: ExportSettings) => isPdf(s) || isSvg(s);
const rasterExt = (f: RasterFormat) => (f === 'jpeg' ? 'jpg' : 'png');

export type ProgressFn = (done: number, total: number, label: string) => void;

/**
 * Renders each item once. Guides are baked into pixels only for raster output; PDFs get vector guides
 * instead, so their artwork is rendered clean. Every export path goes through here, which keeps the
 * guides setting in a single place.
 */
function renderItems(base: SceneBase, items: MediaItem[], s: ExportSettings, guidesBaked: boolean) {
  return Promise.all(items.map((it) => renderItemCanvas(base, it, guidesBaked && sheetGuides(s, base))));
}

/** Die-cut label sheets are already cut to shape, so they never carry cut/fold guides. */
const sheetGuides = (s: ExportSettings, base: SceneBase) => s.guides && !usesLabelSheet(s, base);
const usesLabelSheet = (s: ExportSettings, base: SceneBase) => fitsLabelSheet(getLabelSheet(s.labelSheet), base.template);

/** Single game: flat image, or a one-page PDF/SVG at the wrap's exact size. */
export async function exportCurrent(base: SceneBase, item: MediaItem, s: ExportSettings): Promise<void> {
  if (isVector(s)) {
    const canvas = await renderItemCanvas(base, item, false);
    saveAs(isSvg(s) ? buildItemSvg(canvas, base.template, s.guides) : buildItemPdf(canvas, base.template, s.guides), `${slug(item.title)}.${isSvg(s) ? 'svg' : 'pdf'}`);
    return;
  }
  const canvas = await renderItemCanvas(base, item, s.guides);
  saveAs(await canvasToBlob(canvas, s.format as RasterFormat, s.jpegQuality), `${slug(item.title)}.${rasterExt(s.format as RasterFormat)}`);
}

/** All print sheets as one multi-page PDF. */
export async function exportSheetsPdf(base: SceneBase, items: MediaItem[], s: ExportSettings): Promise<void> {
  const layout = computeLayout(base.template, s.paper, s.labelSheet);
  const pages = paginate(await renderItems(base, items, s, false), layout.placements.length);
  saveAs(buildSheetsPdf(pages, layout, base.template, sheetGuides(s, base)), 'coverforge-sheets.pdf');
}

/**
 * "Download all". Contents depend on the format:
 *  - PNG/JPEG: `<game>/cover.<ext>` per game and `print_sheets/sheet_N.<ext>`
 *  - PDF:      `<game>/cover.pdf` per game and one `print_sheets/sheets.pdf`
 *  - SVG:      `<game>/cover.svg` per game and `print_sheets/sheet_N.svg` (SVG has no pages)
 * Just the rendered covers and print sheets — not the original source images (use *Save* for those).
 */
export async function exportZip(base: SceneBase, items: MediaItem[], s: ExportSettings, onProgress: ProgressFn = () => {}): Promise<void> {
  const zip = new JSZip();
  const total = items.length + 2;
  const used = new Map<string, number>();
  const rendered: HTMLCanvasElement[] = []; // clean (guide-free) renders, reused for the sheets
  const sheetCanvases: HTMLCanvasElement[] = [];

  for (const [i, item] of items.entries()) {
    onProgress(i, total, `Rendering “${item.title}” (${i + 1} of ${items.length})`);
    const n = (used.get(slug(item.title)) ?? 0) + 1;
    used.set(slug(item.title), n);
    const dir = zip.folder(n > 1 ? `${slug(item.title)}-${n}` : slug(item.title))!;

    const clean = await renderItemCanvas(base, item, false);
    rendered.push(clean);
    if (isSvg(s)) {
      dir.file('cover.svg', buildItemSvg(clean, base.template, s.guides));
    } else if (isPdf(s)) {
      dir.file('cover.pdf', buildItemPdf(clean, base.template, s.guides));
    } else {
      const f = s.format as RasterFormat;
      dir.file(`cover.${rasterExt(f)}`, await canvasToBlob(clean, f, s.jpegQuality));
    }
  }

  onProgress(items.length, total, 'Composing print sheets');
  const layout = computeLayout(base.template, s.paper, s.labelSheet);
  const sheetsDir = zip.folder('print_sheets')!;
  if (isSvg(s)) {
    const pages = paginate(rendered, layout.placements.length);
    pages.forEach((page, i) => sheetsDir.file(`sheet_${i + 1}.svg`, buildSheetSvg(page, layout, base.template, sheetGuides(s, base))));
  } else if (isPdf(s)) {
    const pages = paginate(rendered, layout.placements.length);
    sheetsDir.file('sheets.pdf', buildSheetsPdf(pages, layout, base.template, sheetGuides(s, base)));
  } else {
    // Raster sheets bake guides into the pixels; re-render with guides only when requested.
    const source = sheetGuides(s, base) ? await renderItems(base, items, s, true) : rendered;
    const pages = paginate(source, layout.placements.length);
    for (const page of pages) sheetCanvases.push(renderSheetCanvas(page, layout, base.template.dpiScale));
    const f = s.format as RasterFormat;
    for (const [i, sheet] of sheetCanvases.entries()) {
      sheetsDir.file(`sheet_${i + 1}.${rasterExt(f)}`, await canvasToBlob(sheet, f, s.jpegQuality));
    }
  }

  onProgress(items.length + 1, total, 'Compressing ZIP');
  saveAs(await zip.generateAsync({ type: 'blob' }), 'coverforge-pack.zip');
}
