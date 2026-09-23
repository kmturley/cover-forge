import type { MediaItem } from '../types/media';
import type { TemplateConfig } from '../types/template';
import type { Design, SharedSettings, StyleOverlay } from '../types/editor';
import { canvasSizePx } from '../templates';
import { drawGuides } from './GuideOverlays';
import { drawSpineText } from './SpineTypography';
import { getCachedImage, loadImages } from './imageCache';
import { BASE_BACKGROUND, PANEL_IDS, resolvePanel, resolveSpine } from './resolve';
import { computePlacement, paintRect } from './placement';
import { designOf, layeredShared } from './designs';
import { drawLogo } from './logo';
import { drawCode } from './code';
import { drawBorder } from './border';
import { getBrand } from '../brands';
import { drawOfficial, spineCapMm } from './official';
import { drawWear, planWear } from './wear';
import { seedFrom } from './random';

export interface Scene {
  template: TemplateConfig;
  item: MediaItem | null;
  shared: SharedSettings;
  /** The designs items can use; an item's design sits between `shared` (Default) and its own overrides. */
  designs?: Design[];
  /** Global aesthetic: clean artwork, official-style headers, or worn retro. */
  style: StyleOverlay;
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
  const { template: t, item } = scene;
  const shared = layeredShared(scene.shared, designOf(scene.designs, item));
  ctx.save();
  ctx.clearRect(0, 0, t.totalWidthMm * px, t.totalHeightMm * px);
  ctx.fillStyle = BASE_BACKGROUND;
  ctx.fillRect(0, 0, t.totalWidthMm * px, t.totalHeightMm * px);

  for (const panel of t.panels) {
    const area = paintRect(t, panel);
    const r = resolvePanel(shared, item, panel.follows ?? panel.id);
    if (r.backgroundColor) {
      ctx.fillStyle = r.backgroundColor;
      ctx.fillRect(area.xMm * px, area.yMm * px, area.widthMm * px, area.heightMm * px);
    }
    if (panel.follows) continue; // a dust flap is plain: no image, border, logo or code

    const img = getImage(r.imageUrl);
    if (img) {
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
    drawBorder(ctx, panel, r.border, px);
  }

  const digital = scene.style === 'digital';
  if (digital) drawOfficial(ctx, t, px);

  if (item) {
    const settings = resolveSpine(shared, item);
    for (const p of t.panels) {
      // With the Official style the spine has a cap at its start; keep the title clear of it.
      if (p.text) drawSpineText(ctx, p, settings.text ?? item.title, settings, px, p.text, { start: spineCapMm(t.kind, digital), end: 0 });
    }
  }

  // Brand logos sit above every image and the spine text.
  for (const panel of t.panels.filter((q) => !q.follows)) {
    const { logo } = resolvePanel(shared, item, panel.id);
    const brand = getBrand(logo.brand);
    if (brand && item) drawLogo(ctx, t, panel, brand, logo, px);
  }

  // QR codes and barcodes go on top of logos.
  for (const panel of t.panels.filter((q) => !q.follows)) {
    const { code } = resolvePanel(shared, item, panel.id);
    if (item && code.kind !== 'none') drawCode(ctx, t, panel, code, item, px);
  }

  if (scene.style === 'retro') drawWear(ctx, planWear(t, seedFrom(`${item?.id ?? ''}|${t.id}`)), px);

  if (scene.showGuides) drawGuides(ctx, t, px);
  ctx.restore();
}

/** Preloads every image the item uses so a subsequent synchronous render is complete. */
export function preloadItem({ item, shared, designs }: Pick<Scene, 'item' | 'shared' | 'designs'>): Promise<unknown> {
  if (!item) return Promise.resolve();
  const layered = layeredShared(shared, designOf(designs, item));
  return loadImages(PANEL_IDS.map((id) => resolvePanel(layered, item, id).imageUrl));
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
    void preloadItem(scene).then(() => this.invalidate());
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
