import type { Bounds } from '../../engine/layers/bounds';
import { HANDLES, canResize, type Guide } from '../../engine/layers/manipulate';
import { handlePoint } from './useLayerDrag';

interface Props {
  selected: Bounds | null;
  guides: Guide[];
  readout: string | null;
  /** Where the canvas sits in the viewport (CSS px) and how big it is; `mm` is the width of one millimetre. */
  left: number;
  top: number;
  width: number;
  height: number;
  mm: number;
  totalWidthMm: number;
  totalHeightMm: number;
}

/**
 * The part of a layer's box inside its panel's trim, relative to the box (mm), or null when it all is (or the box is
 * turned, where an upright clip wouldn't follow it). A layer that runs into the bleed (a side strip, a header band, the
 * cover picture) is outlined there, so its box doesn't look cut off where the trimmed piece ends.
 */
export function insideTrim(selected: Bounds): { x: number; y: number; w: number; h: number } | null {
  const { rect: r, panel: p } = selected;
  if (selected.rotationDeg % 360 !== 0) return null;
  const [x0, y0] = [Math.max(r.xMm, p.xMm), Math.max(r.yMm, p.yMm)];
  const [x1, y1] = [Math.min(r.xMm + r.widthMm, p.xMm + p.widthMm), Math.min(r.yMm + r.heightMm, p.yMm + p.heightMm)];
  const eps = 0.01;
  const outside = x0 - r.xMm > eps || y0 - r.yMm > eps || r.xMm + r.widthMm - x1 > eps || r.yMm + r.heightMm - y1 > eps;
  return outside && x1 > x0 && y1 > y0 ? { x: x0 - r.xMm, y: y0 - r.yMm, w: x1 - x0, h: y1 - y0 } : null;
}

/**
 * What is drawn over the 2D canvas while editing layers: an outline round the selected one (with handles when it can be
 * resized), the lines a drag snapped to, and its size while dragging. A layer that reaches into the bleed is outlined at
 * the trim, with the rest of its box (where the handles are) faint and dashed. It takes no pointer events; the canvas
 * handles them.
 */
export function LayerOverlay({ selected, guides, readout, left, top, width, height, mm }: Props) {
  const r = selected?.rect;
  const trim = selected ? insideTrim(selected) : null;
  return (
    <div className="layer-overlay" aria-hidden="true">
      {guides.map((g, i) =>
        g.axis === 'x' ? <span key={i} className="snap-guide vertical" style={{ left: left + g.at * mm, top, height }} /> : <span key={i} className="snap-guide horizontal" style={{ top: top + g.at * mm, left, width }} />,
      )}
      {selected && r && (
        <div
          className={`layer-outline ${selected.movable ? '' : 'fixed'} ${selected.whole ? 'whole' : ''} ${trim ? 'into-bleed' : ''}`}
          style={{ left: left + r.xMm * mm, top: top + r.yMm * mm, width: r.widthMm * mm, height: r.heightMm * mm, transform: `rotate(${selected.rotationDeg}deg)` }}
        >
          {trim && <span className={`layer-outline-trim ${selected.movable ? '' : 'fixed'}`} style={{ left: trim.x * mm, top: trim.y * mm, width: trim.w * mm, height: trim.h * mm }} />}
          {selected.movable && (!selected.whole || selected.layer.type === 'image') && canResize(selected.layer) && HANDLES.map((h) => {
            const p = handlePoint({ xMm: 0, yMm: 0, widthMm: r.widthMm, heightMm: r.heightMm }, h);
            return <span key={h} className="layer-handle" style={{ left: p.x * mm, top: p.y * mm }} />;
          })}
        </div>
      )}
      {readout && selected && r && <span className="drag-readout" style={{ left: left + (r.xMm + r.widthMm / 2) * mm, top: top + (r.yMm + r.heightMm) * mm + 8 }}>{readout}</span>}
    </div>
  );
}
