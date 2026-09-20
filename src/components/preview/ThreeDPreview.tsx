import { useEffect, useMemo } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three';
import { useAppState, useSelectedItem } from '../../context/AppContext';
import { preloadItem, renderCover } from '../../engine/CanvasRenderer';
import { PreviewScene } from '../../three/PreviewScene';

/** Texture resolution: aim for ~2048 px across (crisp without a huge upload per edit), between 7 and 24 px/mm. */
const previewPxPerMm = (widthMm: number) => Math.min(24, Math.max(7, 2048 / widthMm));

/** Flags the GPU copy of a texture as stale after its source canvas was repainted. */
function markStale(t: Texture): void {
  t.needsUpdate = true;
}

export function ThreeDPreview() {
  const { template, shared, showGuides, styleOverlay } = useAppState();
  const item = useSelectedItem();

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
      renderCover(ctx, { template, item, shared, style: styleOverlay, showGuides }, canvas.width / template.totalWidthMm);
      markStale(texture);
    };
    paint();
    void preloadItem(item, shared).then(paint);
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, template, item, shared, styleOverlay, showGuides]);

  return (
    <div className="three-wrap">
      <PreviewScene texture={texture} template={template} />
      <p className="hint">Drag to rotate · scroll to zoom</p>
    </div>
  );
}
