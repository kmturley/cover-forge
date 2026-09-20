import { useEffect, useMemo } from 'react';
import { CanvasTexture, LinearFilter, SRGBColorSpace, type Texture } from 'three';
import { useAppState, useSelectedItem } from '../../context/AppContext';
import { preloadItem, renderCover } from '../../engine/CanvasRenderer';
import { BlurayScene } from '../../three/BlurayScene';

/** Texture resolution: ~7 px/mm keeps the sleeve crisp without a 3248px upload per edit. */
const PREVIEW_PX_PER_MM = 7;

/** Flags the GPU copy of a texture as stale after its source canvas was repainted. */
function markStale(t: Texture): void {
  t.needsUpdate = true;
}

export function ThreeDPreview() {
  const { template, shared } = useAppState();
  const item = useSelectedItem();

  // A dedicated offscreen render (guides off) so editor guide lines never appear on the 3D case.
  const canvas = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = Math.round(template.totalWidthMm * PREVIEW_PX_PER_MM);
    c.height = Math.round(template.totalHeightMm * PREVIEW_PX_PER_MM);
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
      renderCover(ctx, { template, item, shared, showGuides: false }, PREVIEW_PX_PER_MM);
      markStale(texture);
    };
    paint();
    void preloadItem(item, shared).then(paint);
    return () => {
      cancelled = true;
    };
  }, [canvas, texture, template, item, shared]);

  return (
    <div className="three-wrap">
      <BlurayScene texture={texture} template={template} />
      <p className="hint">Drag to rotate · scroll to zoom</p>
    </div>
  );
}
