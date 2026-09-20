import { MAX_SCALE, MIN_SCALE, type PanelTransform } from '../types/editor';
import type { PanelId } from '../types/template';
import type { CanvasRenderer } from './CanvasRenderer';

/**
 * Pointer handling for the 2D canvas: drag to pan an image inside its panel, wheel to zoom.
 * Drags mutate renderer state directly (no React churn) and commit once on pointer release.
 */
export class InteractionController {
  private drag: { panel: PanelId; startX: number; startY: number; start: PanelTransform; moved: boolean } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly renderer: CanvasRenderer,
    /** Called with only the fields that changed, so shared/override layers stay field-granular. */
    private readonly onCommit: (panel: PanelId, patch: Partial<PanelTransform>) => void,
    private readonly onSelect?: (panel: PanelId) => void,
  ) {
    canvas.addEventListener('pointerdown', this.down);
    canvas.addEventListener('pointermove', this.move);
    canvas.addEventListener('pointerup', this.up);
    canvas.addEventListener('pointercancel', this.up);
    canvas.addEventListener('wheel', this.wheel, { passive: false });
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.down);
    this.canvas.removeEventListener('pointermove', this.move);
    this.canvas.removeEventListener('pointerup', this.up);
    this.canvas.removeEventListener('pointercancel', this.up);
    this.canvas.removeEventListener('wheel', this.wheel);
  }

  /** Client coordinates → mm on the template canvas. */
  private toMm(e: { clientX: number; clientY: number }): { x: number; y: number } | null {
    const scene = this.renderer.getScene();
    if (!scene) return null;
    const r = this.canvas.getBoundingClientRect();
    const mmPerCssPx = scene.template.totalWidthMm / r.width;
    return { x: (e.clientX - r.left) * mmPerCssPx, y: (e.clientY - r.top) * mmPerCssPx };
  }

  private hit(e: { clientX: number; clientY: number }): PanelId | null {
    const scene = this.renderer.getScene();
    const p = this.toMm(e);
    if (!scene || !p) return null;
    const panel = scene.template.panels.find(
      (r) => p.x >= r.xMm && p.x < r.xMm + r.widthMm && p.y >= r.yMm && p.y < r.yMm + r.heightMm,
    );
    return panel?.id ?? null;
  }

  private down = (e: PointerEvent): void => {
    const panel = this.hit(e);
    if (!panel) return;
    this.onSelect?.(panel);
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { panel, startX: e.clientX, startY: e.clientY, start: this.renderer.getTransform(panel), moved: false };
  };

  private move = (e: PointerEvent): void => {
    if (!this.drag) {
      this.canvas.style.cursor = this.hit(e) ? 'grab' : 'default';
      return;
    }
    const scene = this.renderer.getScene();
    if (!scene) return;
    const mmPerCssPx = scene.template.totalWidthMm / this.canvas.getBoundingClientRect().width;
    const { panel, start } = this.drag;
    this.drag.moved = true;
    this.renderer.setLiveTransform(panel, {
      ...start,
      panXMm: start.panXMm + (e.clientX - this.drag.startX) * mmPerCssPx,
      panYMm: start.panYMm + (e.clientY - this.drag.startY) * mmPerCssPx,
    });
  };

  private up = (e: PointerEvent): void => {
    if (!this.drag) return;
    const { panel, moved } = this.drag;
    this.drag = null;
    if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
    // A plain click only selects the panel; committing would create a needless override.
    if (!moved) return;
    const { panXMm, panYMm } = this.renderer.getTransform(panel);
    this.onCommit(panel, { panXMm, panYMm });
  };

  private wheel = (e: WheelEvent): void => {
    const panel = this.hit(e);
    if (!panel) return;
    e.preventDefault();
    const cur = this.renderer.getTransform(panel);
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, cur.scale * Math.exp(-e.deltaY * 0.0015)));
    this.onCommit(panel, { scale });
  };
}
