import type { MediaItem } from '../types/media';
import type { PanelId, PanelRect, TemplateConfig } from '../types/template';
import type { PanelTransform, SharedSettings } from '../types/editor';
import { canvasSizePx } from '../templates';
import { drawGuides } from './GuideOverlays';
import { drawSpineText } from './SpineTypography';
import { getCachedImage, loadImages } from './imageCache';
import { BASE_BACKGROUND, PANEL_IDS, resolvePanel, resolveSpine } from './resolve';

export interface Scene {
  template: TemplateConfig;
  item: MediaItem | null;
  shared: SharedSettings;
  showGuides: boolean;
}

export type ImageLookup = (url: string | null | undefined) => HTMLImageElement | null;

/** A panel's paint area: the trim rect, extended into the bleed on any edge that touches the canvas edge. */
export function paintRect(t: TemplateConfig, p: PanelRect): PanelRect {
  const left = p.xMm <= t.bleedMm ? t.bleedMm : 0;
  const right = p.xMm + p.widthMm >= t.totalWidthMm - t.bleedMm ? t.bleedMm : 0;
  return {
    ...p,
    xMm: p.xMm - left,
    yMm: p.yMm - t.bleedMm,
    widthMm: p.widthMm + left + right,
    heightMm: p.heightMm + t.bleedMm * 2,
  };
}

/**
 * Renders the full flat cover. Pure and synchronous: used by the editor, the 3D texture and export.
 * `px` is pixels per mm, so the same code serves screen previews and 300 DPI output.
 */
export function renderCover(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  px: number,
  getImage: ImageLookup = getCachedImage,
  transformOverrides: Partial<Record<PanelId, PanelTransform>> = {},
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
    const tr = transformOverrides[panel.id] ?? r.transform;

    ctx.save();
    ctx.beginPath();
    ctx.rect(area.xMm * px, area.yMm * px, area.widthMm * px, area.heightMm * px);
    ctx.clip();
    ctx.globalAlpha = tr.opacity ?? 1;

    // Cover-fit: the smallest scale that fills the panel, then the user's zoom on top.
    const fit = Math.max(area.widthMm / img.naturalWidth, area.heightMm / img.naturalHeight) * tr.scale;
    ctx.translate((area.xMm + area.widthMm / 2 + tr.panXMm) * px, (area.yMm + area.heightMm / 2 + tr.panYMm) * px);
    ctx.rotate((tr.rotationDeg * Math.PI) / 180);
    ctx.scale(fit * px, fit * px);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    ctx.restore();
  }

  const spine = t.panels.find((p) => p.id === 'spine');
  if (spine && item) {
    const settings = resolveSpine(shared, item);
    drawSpineText(ctx, spine, settings.text ?? item.title, settings, px);
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
 * frame only when marked dirty. Drag state lives here (mutable), not in React.
 */
export class CanvasRenderer {
  private scene: Scene | null = null;
  private live: Partial<Record<PanelId, PanelTransform>> = {};
  private dirty = false;
  private raf = 0;
  private disposed = false;
  private readonly ctx: CanvasRenderingContext2D;

  /** Called after every repaint (the 3D preview uses this to know the flat art changed). */
  onPaint?: () => void;

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
    // Item switched or override committed: drop any stale drag state.
    this.live = {};
    void preloadItem(scene.item, scene.shared).then(() => this.invalidate());
    this.invalidate();
  }

  /** Temporary transform while dragging, committed to React state on pointer release. */
  setLiveTransform(id: PanelId, t: PanelTransform | null): void {
    if (t) this.live[id] = t;
    else delete this.live[id];
    this.invalidate();
  }

  getTransform(id: PanelId): PanelTransform {
    if (this.live[id]) return this.live[id]!;
    return resolvePanel(this.scene!.shared, this.scene!.item, id).transform;
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
    renderCover(this.ctx, this.scene, this.scene.template.dpiScale, getCachedImage, this.live);
    this.onPaint?.();
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
  }
}
