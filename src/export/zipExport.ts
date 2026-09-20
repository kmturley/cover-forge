import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { MediaItem } from '../types/media';
import { libraryImages } from '../engine/imageLibrary';
import { loadImage } from '../engine/imageCache';
import { srcOf } from '../storage/localImages';
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
 * Original asset bytes. `cache: 'reload'` avoids a cached copy that was stored without CORS headers
 * (e.g. by a plain <img>), which would make fetch() fail. If fetching still fails, re-encode the
 * (CORS-clean) decoded image instead so the asset isn't silently dropped.
 */
async function fetchAsset(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(srcOf(url) ?? url, { cache: 'reload' });
    if (res.ok) return await res.blob();
  } catch {
    // fall through to the canvas re-encode
  }
  const img = await loadImage(url);
  if (!img) return null;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  c.getContext('2d')!.drawImage(img, 0, 0);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}

const extFromBlob = (b: Blob) => ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })[b.type] ?? 'jpg';

/** Adds every library image of an item to `folder`; returns the names that couldn't be retrieved. */
async function addAssets(folder: JSZip, item: MediaItem): Promise<string[]> {
  const images = libraryImages(item);
  const results = await Promise.all(images.map((img) => fetchAsset(img.url)));
  const missing: string[] = [];
  results.forEach((blob, i) => {
    const { ref } = images[i];
    const name = ref.startsWith('screenshot:') ? `screenshot_${Number(ref.slice(11)) + 1}` : ref;
    if (blob) folder.file(`${name}.${extFromBlob(blob)}`, blob);
    else missing.push(`${item.title}: ${images[i].label}`);
  });
  return missing;
}

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

export interface ZipResult {
  /** Assets that couldn't be downloaded (e.g. a game with no logo image). */
  missingAssets: string[];
}

/**
 * "Download all". Contents depend on the format:
 *  - PNG/JPEG: `<game>/cover.<ext>` per game and `print_sheets/sheet_N.<ext>`
 *  - PDF:      `<game>/cover.pdf` per game and one `print_sheets/sheets.pdf`
 *  - SVG:      `<game>/cover.svg` per game and `print_sheets/sheet_N.svg` (SVG has no pages)
 * plus `<game>/assets/*` (the original images) in both cases.
 */
export async function exportZip(
  base: SceneBase,
  items: MediaItem[],
  s: ExportSettings,
  onProgress: ProgressFn = () => {},
): Promise<ZipResult> {
  const zip = new JSZip();
  const total = items.length + 2;
  const missingAssets: string[] = [];
  const used = new Map<string, number>();
  const rendered: HTMLCanvasElement[] = []; // clean (guide-free) renders, reused for the sheets
  const sheetCanvases: HTMLCanvasElement[] = [];

  for (const [i, item] of items.entries()) {
    const step = `(${i + 1} of ${items.length})`;
    onProgress(i, total, `Rendering “${item.title}” ${step}`);
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

    onProgress(i, total, `Fetching assets for “${item.title}” ${step}`);
    missingAssets.push(...(await addAssets(dir.folder('assets')!, item)));
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
  return { missingAssets };
}
