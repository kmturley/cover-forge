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
  type ExportBase,
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

/** A sheet holds one template's covers, so items are laid out in groups of the same template (in queue order). */
export function groupByTemplate(base: ExportBase, items: MediaItem[]): { base: SceneBase; items: MediaItem[] }[] {
  const groups = new Map<string, { base: SceneBase; items: MediaItem[] }>();
  for (const item of items) {
    const template = base.templateOf(item);
    const { templateOf: _drop, ...rest } = base;
    void _drop;
    const g = groups.get(template.id) ?? { base: { ...rest, template }, items: [] };
    g.items.push(item);
    groups.set(template.id, g);
  }
  return [...groups.values()];
}

/** Single game: flat image, or a one-page PDF/SVG at the wrap's exact size. */
export async function exportCurrent(all: ExportBase, item: MediaItem, s: ExportSettings): Promise<void> {
  const [{ base }] = groupByTemplate(all, [item]);
  if (isVector(s)) {
    const canvas = await renderItemCanvas(base, item, false);
    saveAs(isSvg(s) ? buildItemSvg(canvas, base.template, s.guides) : buildItemPdf(canvas, base.template, s.guides), `${slug(item.title)}.${isSvg(s) ? 'svg' : 'pdf'}`);
    return;
  }
  const canvas = await renderItemCanvas(base, item, s.guides);
  saveAs(await canvasToBlob(canvas, s.format as RasterFormat, s.jpegQuality), `${slug(item.title)}.${rasterExt(s.format as RasterFormat)}`);
}

/** All print sheets as a multi-page PDF, one per template in the queue. */
export async function exportSheetsPdf(all: ExportBase, items: MediaItem[], s: ExportSettings): Promise<void> {
  const groups = groupByTemplate(all, items);
  for (const { base, items: group } of groups) {
    const layout = computeLayout(base.template, s.paper, s.labelSheet);
    const pages = paginate(await renderItems(base, group, s, false), layout.placements.length);
    const name = groups.length > 1 ? `coverforge-sheets-${slug(base.template.id)}.pdf` : 'coverforge-sheets.pdf';
    saveAs(buildSheetsPdf(pages, layout, base.template, sheetGuides(s, base)), name);
  }
}

/**
 * "Download all". Contents depend on the format:
 *  - PNG/JPEG: `<game>/cover.<ext>` per game and `print_sheets/sheet_N.<ext>`
 *  - PDF:      `<game>/cover.pdf` per game and one `print_sheets/sheets.pdf`
 *  - SVG:      `<game>/cover.svg` per game and `print_sheets/sheet_N.svg` (SVG has no pages)
 * With more than one template in the queue the sheets go in a folder per template (`print_sheets/<template>/…`).
 * Just the rendered covers and print sheets — not the original source images (use *Save* for those).
 */
export async function exportZip(all: ExportBase, items: MediaItem[], s: ExportSettings, onProgress: ProgressFn = () => {}): Promise<void> {
  const zip = new JSZip();
  const total = items.length + 2;
  const used = new Map<string, number>();
  const groups = groupByTemplate(all, items);
  const sheetsRoot = zip.folder('print_sheets')!;
  let i = 0;

  for (const { base, items: group } of groups) {
    const rendered: HTMLCanvasElement[] = []; // clean (guide-free) renders, reused for the sheets
    for (const item of group) {
      onProgress(i, total, `Rendering “${item.title}” (${i + 1} of ${items.length})`);
      i++;
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
    onProgress(i, total, 'Composing print sheets');
    await addSheets(groups.length > 1 ? sheetsRoot.folder(slug(base.template.id))! : sheetsRoot, base, group, rendered, s);
  }

  onProgress(items.length + 1, total, 'Compressing ZIP');
  saveAs(await zip.generateAsync({ type: 'blob' }), 'coverforge-pack.zip');
}

/** One template's print sheets, from its items' clean renders. */
async function addSheets(sheetsDir: JSZip, base: SceneBase, items: MediaItem[], rendered: HTMLCanvasElement[], s: ExportSettings): Promise<void> {
  const layout = computeLayout(base.template, s.paper, s.labelSheet);
  const sheetCanvases: HTMLCanvasElement[] = [];
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
}
