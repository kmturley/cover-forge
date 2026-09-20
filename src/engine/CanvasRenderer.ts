import type { MediaItem } from '../types/media';
import type { TemplateConfig } from '../types/template';
import type { SharedSettings } from '../types/editor';
import { canvasSizePx } from '../templates';
import { drawGuides } from './GuideOverlays';
import { drawSpineText } from './SpineTypography';
import { getCachedImage, loadImages } from './imageCache';
import { BASE_BACKGROUND, PANEL_IDS, resolvePanel, resolveSpine } from './resolve';
import { computePlacement, paintRect } from './placement';
import { drawLogo } from './logo';
import { getBrand } from '../brands';

export interface Scene {
  template: TemplateConfig;
  item: MediaItem | null;
  shared: SharedSettings;
  showGuides: boolean;
}

export type ImageLookup = (url: string | null | undefined) => HTMLImageElement | null;

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
  const { template: t, item, shared } = scene;
  ctx.save();
  ctx.clearRect(0, 0, t.totalWidthMm * px, t.totalHeightMm * px);
  ctx.fillStyle = BASE_BACKGROUND;
  ctx.fillRect(0, 0, t.totalWidthMm * px, t.totalHeightMm * px);

  for (const panel of t.panels) {
    const area = paintRect(t, panel);
    const r = resolvePanel(shared, item, panel.id);
    if (r.backgroundColor) {
      ctx.fillStyle = r.backgroundColor;
      ctx.fillRect(area.xMm * px, area.yMm * px, area.widthMm * px, area.heightMm * px);
    }

    const img = getImage(r.imageUrl);
    if (!img) continue;
    const tr = r.transform;

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.xMm * px, area.yMm * px, area.widthMm * px, area.heightMm * px);
    ctx.clip();
    ctx.globalAlpha = tr.opacity ?? 1;

    // Position is the image's top-left from the panel's visible top-left (centred by default); rotation is about the image centre.
    const pl = computePlacement(t, panel, img.naturalWidth, img.naturalHeight, tr);
    ctx.translate((pl.area.xMm + pl.xMm + pl.widthMm / 2) * px, (pl.area.yMm + pl.yMm + pl.heightMm / 2) * px);
    ctx.rotate((tr.rotationDeg * Math.PI) / 180);
    ctx.scale(pl.fit * px, pl.fit * px);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }

  const spine = t.panels.find((p) => p.id === 'spine');
  if (spine && item) {
    const settings = resolveSpine(shared, item);
    drawSpineText(ctx, spine, settings.text ?? item.title, settings, px);
  }

  // Brand logos sit above every image and the spine text.
  for (const panel of t.panels) {
    const { logo } = resolvePanel(shared, item, panel.id);
    const brand = getBrand(logo.brand);
    if (brand && item) drawLogo(ctx, t, panel, brand, logo, px);
  }

  if (scene.showGuides) drawGuides(ctx, t, px);
  ctx.restore();
}

/** Preloads every image the item uses so a subsequent synchronous render is complete. */
export function preloadItem(item: MediaItem | null, shared: SharedSettings): Promise<unknown> {
  return item ? loadImages(PANEL_IDS.map((id) => resolvePanel(shared, item, id).imageUrl)) : Promise.resolve();
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
    void preloadItem(scene.item, scene.shared).then(() => this.invalidate());
    this.invalidate();
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
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }
}
