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
 * What is drawn over the 2D canvas while editing layers: an outline round the selected one (with handles when it can be
 * resized), the lines a drag snapped to, and its size while dragging. It takes no pointer events; the canvas handles them.
 */
export function LayerOverlay({ selected, guides, readout, left, top, width, height, mm }: Props) {
  const r = selected?.rect;
  return (
    <div className="layer-overlay" aria-hidden="true">
      {guides.map((g, i) =>
        g.axis === 'x' ? <span key={i} className="snap-guide vertical" style={{ left: left + g.at * mm, top, height }} /> : <span key={i} className="snap-guide horizontal" style={{ top: top + g.at * mm, left, width }} />,
      )}
      {selected && r && (
        <div
          className={`layer-outline ${selected.movable ? '' : 'fixed'} ${selected.whole ? 'whole' : ''}`}
          style={{ left: left + r.xMm * mm, top: top + r.yMm * mm, width: r.widthMm * mm, height: r.heightMm * mm, transform: `rotate(${selected.rotationDeg}deg)` }}
        >
          {selected.movable && !selected.whole && canResize(selected.layer) && HANDLES.map((h) => {
            const p = handlePoint({ xMm: 0, yMm: 0, widthMm: r.widthMm, heightMm: r.heightMm }, h);
            return <span key={h} className="layer-handle" style={{ left: p.x * mm, top: p.y * mm }} />;
          })}
        </div>
      )}
      {readout && selected && r && <span className="drag-readout" style={{ left: left + (r.xMm + r.widthMm / 2) * mm, top: top + (r.yMm + r.heightMm) * mm + 8 }}>{readout}</span>}
    </div>
  );
}
