import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { MediaItem } from '../types/media';
import { libraryImages } from '../engine/imageLibrary';
import { loadImage } from '../engine/imageCache';
import { impose, paginate } from './imposition';
import { buildItemPdf, buildSheetsPdf } from './pdfExport';
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
const rasterExt = (f: RasterFormat) => (f === 'jpeg' ? 'jpg' : 'png');

export type ProgressFn = (done: number, total: number, label: string) => void;

/**
 * Original asset bytes. `cache: 'reload'` avoids a cached copy that was stored without CORS headers
 * (e.g. by a plain <img>), which would make fetch() fail. If fetching still fails, re-encode the
 * (CORS-clean) decoded image instead so the asset isn't silently dropped.
 */
async function fetchAsset(url: string): Promise<Blob | null> {
  try {
    const res = await fetch(url, { cache: 'reload' });
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
  return Promise.all(items.map((it) => renderItemCanvas(base, it, guidesBaked && s.guides)));
}

/** Single game: flat image, or a one-page PDF at the wrap's exact size. */
export async function exportCurrent(base: SceneBase, item: MediaItem, s: ExportSettings): Promise<void> {
  if (isPdf(s)) {
    const canvas = await renderItemCanvas(base, item, false);
    saveAs(buildItemPdf(canvas, base.template, s.guides), `${slug(item.title)}.pdf`);
    return;
  }
  const canvas = await renderItemCanvas(base, item, s.guides);
  saveAs(await canvasToBlob(canvas, s.format as RasterFormat, s.jpegQuality), `${slug(item.title)}.${rasterExt(s.format as RasterFormat)}`);
}

/** All print sheets as one multi-page PDF. */
export async function exportSheetsPdf(base: SceneBase, items: MediaItem[], s: ExportSettings): Promise<void> {
  const layout = impose(base.template.totalWidthMm, base.template.totalHeightMm, s.paper);
  const pages = paginate(await renderItems(base, items, s, false), layout.placements.length);
  saveAs(buildSheetsPdf(pages, layout, base.template, s.guides), 'coverforge-sheets.pdf');
}

export interface ZipResult {
  /** Assets that couldn't be downloaded (e.g. a game with no logo image). */
  missingAssets: string[];
}

/**
 * "Download all". Contents depend on the format:
 *  - PNG/JPEG: `<game>/cover.<ext>` per game and `print_sheets/sheet_N.<ext>`
 *  - PDF:      `<game>/cover.pdf` per game and one `print_sheets/sheets.pdf`
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
    if (isPdf(s)) {
      dir.file('cover.pdf', buildItemPdf(clean, base.template, s.guides));
    } else {
      const f = s.format as RasterFormat;
      dir.file(`cover.${rasterExt(f)}`, await canvasToBlob(clean, f, s.jpegQuality));
    }

    onProgress(i, total, `Fetching assets for “${item.title}” ${step}`);
    missingAssets.push(...(await addAssets(dir.folder('assets')!, item)));
  }

  onProgress(items.length, total, 'Composing print sheets');
  const layout = impose(base.template.totalWidthMm, base.template.totalHeightMm, s.paper);
  const sheetsDir = zip.folder('print_sheets')!;
  if (isPdf(s)) {
    const pages = paginate(rendered, layout.placements.length);
    sheetsDir.file('sheets.pdf', buildSheetsPdf(pages, layout, base.template, s.guides));
  } else {
    // Raster sheets bake guides into the pixels; re-render with guides only when requested.
    const source = s.guides ? await renderItems(base, items, s, true) : rendered;
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
