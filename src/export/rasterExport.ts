import type { MediaItem } from '../types/media';
import type { Scene } from '../engine/CanvasRenderer';
import { preloadItem, renderCover } from '../engine/CanvasRenderer';
import { canvasSizePx } from '../templates';
import { PAPER_MM, type Imposition, type PaperSize } from './imposition';

export type RasterFormat = 'png' | 'jpeg';

export type ExportFormat = RasterFormat | 'pdf';

export interface ExportSettings {
  paper: PaperSize;
  format: ExportFormat;
  /** Cut/fold guides on sheets and (for PDF) on each game's page. Off by default. */
  guides: boolean;
  jpegQuality: number;
}

export type SceneBase = Omit<Scene, 'item' | 'showGuides'>;

export function canvasToBlob(canvas: HTMLCanvasElement, format: RasterFormat, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Canvas export failed (is the canvas tainted by a cross-origin image?)'))),
      `image/${format}`,
      quality,
    );
  });
}

/** Renders one item's flat wrap at full 300 DPI on a fresh offscreen canvas. */
export async function renderItemCanvas(base: SceneBase, item: MediaItem, guides: boolean): Promise<HTMLCanvasElement> {
  await preloadItem(item, base.shared);
  const { width, height } = canvasSizePx(base.template);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  renderCover(canvas.getContext('2d')!, { ...base, item, showGuides: guides }, base.template.dpiScale);
  return canvas;
}

/** Returns the canvas turned 90° clockwise (the orientation impose() uses for `rotated`). */
export function rotateClockwise(src: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = src.height;
  out.height = src.width;
  const ctx = out.getContext('2d')!;
  ctx.translate(src.height, 0);
  ctx.rotate(Math.PI / 2);
  ctx.drawImage(src, 0, 0);
  return out;
}

/** Composes rendered item canvases onto one 300 DPI sheet following an imposition layout. */
export function renderSheetCanvas(items: HTMLCanvasElement[], layout: Imposition, dpiScale: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.paper.widthMm * dpiScale);
  canvas.height = Math.round(layout.paper.heightMm * dpiScale);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  items.forEach((item, i) => {
    const p = layout.placements[i];
    if (!p) return;
    const src = p.rotated ? rotateClockwise(item) : item;
    // Oversize items are scaled down to fit the paper (not to physical scale).
    const scale = layout.oversize
      ? Math.min(1, canvas.width / src.width, canvas.height / src.height)
      : 1;
    const w = src.width * scale;
    const h = src.height * scale;
    const x = layout.oversize ? (canvas.width - w) / 2 : p.xMm * dpiScale;
    const y = layout.oversize ? (canvas.height - h) / 2 : p.yMm * dpiScale;
    ctx.drawImage(src, x, y, w, h);
  });
  return canvas;
}

export { PAPER_MM };
