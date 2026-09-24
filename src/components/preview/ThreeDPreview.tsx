import { useEffect, useMemo, useRef } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three';
import { useAppState, useSelectedItem } from '../../context/AppContext';
import { useSelectionPulse } from '../../context/useSelectionPulse';
import { preloadItem, renderCover } from '../../engine/CanvasRenderer';
import { PreviewScene } from '../../three/PreviewScene';

/** Texture resolution: aim for ~2048 px across (crisp without a huge upload per edit), between 7 and 24 px/mm. */
const previewPxPerMm = (widthMm: number) => Math.min(24, Math.max(7, 2048 / widthMm));

const PULSE_MS = 1200;

/** Flags the GPU copy of a texture as stale after its source canvas was repainted. */
function markStale(t: Texture): void {
  t.needsUpdate = true;
}

export function ThreeDPreview() {
  const { template, shared, designs, showGuides, styleOverlay, autoRotate } = useAppState();
  const item = useSelectedItem();
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const pulse = useSelectionPulse();

  // A dedicated offscreen render, so the 3D texture resolution is independent of the 2D editor canvas.
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    const px = previewPxPerMm(template.totalWidthMm);
    c.width = Math.round(template.totalWidthMm * px);
    c.height = Math.round(template.totalHeightMm * px);
    return c;
  }, [template]);

  const texture = useMemo(() => {
    const t = new CanvasTexture(canvas);
    t.colorSpace = SRGBColorSpace;
    t.generateMipmaps = false;
    t.minFilter = LinearFilter;
    t.magFilter = LinearFilter;
    t.anisotropy = 8;
    return t;
  }, [canvas]);
  useEffect(() => () => texture.dispose(), [texture]);

  useEffect(() => {
    let cancelled = false;
    const paint = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx || cancelled) return;
      renderCover(ctx, { template, item, shared, designs, style: styleOverlay, showGuides }, canvas.width / template.totalWidthMm);
      // Keep a clean copy so the selection flash can be drawn over it and removed again.
      const base = (baseRef.current ??= document.createElement('canvas'));
      base.width = canvas.width;
      base.height = canvas.height;
      base.getContext('2d')?.drawImage(canvas, 0, 0);
      markStale(texture);
    };
    paint();
    void preloadItem({ item, shared, designs }).then(paint);
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, template, item, shared, designs, styleOverlay, showGuides]);

  // Flash the selected panel on the artwork, fading out over about a second.
  useEffect(() => {
    const panel = pulse && template.panels.find((p) => p.id === pulse.panel);
    const base = baseRef.current;
    const ctx = canvas.getContext('2d');
    if (!panel || !base || !ctx) return;
    const px = canvas.width / template.totalWidthMm;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const a = Math.max(0, 1 - (now - start) / PULSE_MS);
      ctx.drawImage(base, 0, 0);
      if (a > 0) {
        ctx.fillStyle = `rgba(56,189,248,${0.45 * a})`;
        ctx.fillRect(panel.xMm * px, panel.yMm * px, panel.widthMm * px, panel.heightMm * px);
        ctx.strokeStyle = `rgba(255,255,255,${a})`;
        ctx.lineWidth = 0.8 * px;
        ctx.strokeRect(panel.xMm * px, panel.yMm * px, panel.widthMm * px, panel.heightMm * px);
      }
      markStale(texture);
      if (a > 0) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      ctx.drawImage(base, 0, 0);
      markStale(texture);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- a new pulse key is the only trigger
  }, [pulse?.key]);

  return (
    <div className="three-wrap">
      <PreviewScene texture={texture} template={template} autoRotate={autoRotate} />
    </div>
  );
}
