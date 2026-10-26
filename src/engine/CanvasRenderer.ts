import type { MediaItem } from '../types/media';
import type { TemplateConfig } from '../types/template';
import type { Design, SharedSettings } from '../types/editor';
import { canvasSizePx } from '../templates';
import { drawGuides } from './GuideOverlays';
import { getCachedImage, loadImages } from './imageCache';
import { BASE_BACKGROUND, PANEL_IDS, resolvePanel } from './resolve';
import { designOf, layeredShared } from './designs';
import { drawLayers, type ImageLookup } from './layers/draw';
import { resolveLayers } from './layers/resolve';

export interface Scene {
  template: TemplateConfig;
  item: MediaItem | null;
  shared: SharedSettings;
  /** The designs items can use; an item's design sits between `shared` (Default) and its own overrides. */
  designs?: Design[];
  /** Draw the template's official banner (platform or format header) and spine cap. */
  banner: boolean;
  showGuides: boolean;
  /** Clear everything outside the cut lines (bleed, and any gaps between panels), so the canvas looks like the cut-out piece (the 2D view). */
  hideOutsideCut?: boolean;
}

export type { ImageLookup };

/**
 * Renders the full flat cover. Pure and synchronous: used by the editor, the 3D texture and export.
 * `px` is pixels per mm, so the same code serves screen previews and 300 DPI output.
 */
export function renderCover(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  px: number,
  getImage: ImageLookup = getCachedImage,
): void {
  const { template: t, item } = scene;
  ctx.save();
  ctx.clearRect(0, 0, t.totalWidthMm * px, t.totalHeightMm * px);
  ctx.fillStyle = BASE_BACKGROUND;
  ctx.fillRect(0, 0, t.totalWidthMm * px, t.totalHeightMm * px);

  const layers = resolveLayers({ template: t, item, shared: scene.shared, designs: scene.designs });
  drawLayers({ ctx, template: t, item, px, getImage, banner: scene.banner }, layers);

  if (scene.hideOutsideCut) {
    // Keep only what's inside the panels' trim rects. Snapped outwards to whole pixels, so touching panels leave no seam.
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = '#000';
    ctx.beginPath(); // one path, so the panels' union is kept (not just the last one)
    for (const p of t.panels) {
      const [x0, y0] = [Math.floor(p.xMm * px), Math.floor(p.yMm * px)];
      ctx.rect(x0, y0, Math.ceil((p.xMm + p.widthMm) * px) - x0, Math.ceil((p.yMm + p.heightMm) * px) - y0);
    }
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  }
  if (scene.showGuides) drawGuides(ctx, t, px);
  ctx.restore();
}

/** Preloads every image the item uses so a subsequent synchronous render is complete. */
export function preloadItem({ item, shared, designs }: Pick<Scene, 'item' | 'shared' | 'designs'>): Promise<unknown> {
  if (!item) return Promise.resolve();
  const layered = layeredShared(shared, designOf(designs, item));
  return loadImages(PANEL_IDS.map((id) => resolvePanel(layered, item, id, null).imageUrl));
}

/**
 * Owns the on-screen canvas: sizes it to full 300 DPI resolution and repaints on the next animation
 * frame only when marked dirty.
 */
export class CanvasRenderer {
  private scene: Scene | null = null;
  private dirty = false;
  private raf = 0;
  private disposed = false;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly paintListeners = new Set<() => void>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas is not supported');
    this.ctx = ctx;
  }

  setScene(scene: Scene): void {
    const prev = this.scene;
    this.scene = scene;
    if (!prev || prev.template.id !== scene.template.id) {
      const { width, height } = canvasSizePx(scene.template);
      this.canvas.width = width;
      this.canvas.height = height;
    }
    void preloadItem(scene).then(() => this.invalidate());
    this.invalidate();
  }

  /** Calls `fn` after every repaint, so a view that shows a reduced copy can refresh it. Returns the unsubscribe. */
  onPaint(fn: () => void): () => void {
    this.paintListeners.add(fn);
    return () => this.paintListeners.delete(fn);
  }

  getScene(): Scene | null {
    return this.scene;
  }

  invalidate(): void {
    if (this.dirty || this.disposed) return;
    this.dirty = true;
    this.raf = requestAnimationFrame(() => this.paint());
  }

  private paint(): void {
    this.dirty = false;
    if (!this.scene || this.disposed) return;
    renderCover(this.ctx, this.scene, this.scene.template.dpiScale);
    for (const fn of this.paintListeners) fn();
  }

  dispose(): void {
    this.disposed = true;
    this.paintListeners.clear();
    cancelAnimationFrame(this.raf);
  }
}
