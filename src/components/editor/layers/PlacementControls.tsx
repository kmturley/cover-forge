import type { PanelBox } from '../../../types/editor';
import type { Axis, LayerPlacement, Placement } from '../../../types/layers';
import type { PanelRect } from '../../../types/template';
import { boxRect } from '../../../engine/box';
import { boxRange, placementOfBox, placementToBox, reanchor } from '../../../engine/layers/placement';
import { NumberField } from './NumberField';

interface Props {
  placement: LayerPlacement;
  /** The panel the layer sits on, or the printed area for a layer across the canvas. */
  panel: PanelRect;
  /** The content's width / height. Without it a size can't be left automatic. */
  aspect?: number;
  /** The box the automatic (or an older mm) placement amounts to, so switching to a custom one keeps the layer where it is. */
  autoBox?: PanelBox;
  /** Whether "Automatic" is a choice, and what it means for this layer. */
  autoLabel?: string;
  onChange: (p: LayerPlacement) => void;
}

const ANCHORS = ['start', 'center', 'end'] as const;
const WHOLE: PanelBox = { xStart: 0, xEnd: 100, yStart: 0, yEnd: 100 };
const isAnchored = (p: LayerPlacement): p is Placement => !!p && 'x' in p;

const NAMES = {
  x: { start: 'Left', center: 'Centre', end: 'Right', size: 'Width', stretchStart: 'Left', stretchEnd: 'Right' },
  y: { start: 'Top', center: 'Middle', end: 'Bottom', size: 'Height', stretchStart: 'Top', stretchEnd: 'Bottom' },
} as const;

function AxisFields({ axis, which, lengthPct, canAuto, otherIsAuto, onChange }: { axis: Axis; which: 'x' | 'y'; lengthPct: number; canAuto: boolean; otherIsAuto: boolean; onChange: (a: Axis) => void }) {
  const n = NAMES[which];
  if (axis.anchor === 'stretch') {
    return (
      <div className="axis-fields">
        <NumberField label={`${n.stretchStart} inset`} unit="%" step={0.5} decimals={2} value={axis.start} onChange={(start) => onChange({ ...axis, start })} />
        <NumberField label={`${n.stretchEnd} inset`} unit="%" step={0.5} decimals={2} value={axis.end} onChange={(end) => onChange({ ...axis, end })} />
      </div>
    );
  }
  const auto = axis.size === 'auto';
  return (
    <div className="axis-fields">
      <NumberField label={axis.anchor === 'center' ? `${n.center} at` : axis.anchor === 'end' ? `${n[axis.anchor]} inset` : n[axis.anchor]} unit="%" step={0.5} decimals={2} value={axis.offset} onChange={(offset) => onChange({ ...axis, offset })} />
      <div className="size-field">
        <NumberField label={n.size} unit="%" step={0.5} decimals={2} min={0} disabled={auto} value={auto ? lengthPct : (axis.size as number)} onChange={(size) => onChange({ ...axis, size })} />
        {canAuto && (
          <label className="check small" title="Take this length from the picture's shape, so it keeps its proportions">
            <input type="checkbox" checked={auto} disabled={!auto && otherIsAuto} onChange={(e) => onChange({ ...axis, size: e.target.checked ? 'auto' : Number(lengthPct.toFixed(2)) })} />
            Auto
          </label>
        )}
      </div>
    </div>
  );
}

/**
 * Where a layer sits on its panel, set the way design tools do it: pick the point of the layer to place by (the 3×3
 * grid), then type where that point goes and how big the layer is, each in percent of the panel. An axis can instead
 * stretch between two edges, and a size can follow the picture's shape (auto), so a logo "10% wide, centred" is two
 * numbers, with no start-and-end arithmetic. Changing the anchor never moves the layer.
 */
export function PlacementControls({ placement, panel, aspect, autoBox, autoLabel, onChange }: Props) {
  const custom = isAnchored(placement);
  const toCustom = () => onChange(placementOfBox(autoBox ?? WHOLE));

  const mode = autoLabel && (
    <div className="seg" role="group" aria-label="Placement mode">
      <button className={!custom && placement === null ? 'active' : ''} aria-pressed={placement === null} onClick={() => onChange(null)} title={autoLabel}>
        Automatic
      </button>
      <button className={custom ? 'active' : ''} aria-pressed={custom} onClick={() => !custom && toCustom()}>
        Custom
      </button>
    </div>
  );

  if (!isAnchored(placement)) {
    return (
      <div className="placement">
        {mode}
        <p className="muted small">
          {placement === null ? autoLabel : 'Placed in millimetres by an older save.'}
          {' '}
          <button className="link" onClick={toCustom}>{placement === null ? 'Place it myself' : 'Convert to a placement that scales with the case'}</button>
        </p>
      </div>
    );
  }

  const box = placementToBox(panel, placement, aspect);
  const rect = boxRect(panel, box);
  const x = placement.x;
  const y = placement.y;
  const lengthOf = (w: 'x' | 'y') => { const [a, b] = boxRange(box, w); return b - a; };
  const set = (w: 'x' | 'y', a: Axis) => onChange({ ...placement, [w]: a });
  const anchorBoth = (cx: (typeof ANCHORS)[number], cy: (typeof ANCHORS)[number]) => onChange(reanchor(panel, reanchor(panel, placement, 'x', cx, aspect), 'y', cy, aspect));

  return (
    <div className="placement">
      {mode}
      <div className="placement-grid-row">
        <div className="anchor-grid" role="group" aria-label="Point of the layer to place by">
          {ANCHORS.map((ay) =>
            ANCHORS.map((ax) => {
              const on = x.anchor === ax && y.anchor === ay;
              const near = (x.anchor === 'stretch' || x.anchor === ax) && (y.anchor === 'stretch' || y.anchor === ay);
              return (
                <button key={`${ax}-${ay}`} className={`${on ? 'on' : ''} ${near && !on ? 'near' : ''}`} aria-pressed={on} aria-label={`${NAMES.y[ay]} ${NAMES.x[ax]}`.toLowerCase()} title={`Place by the ${NAMES.y[ay].toLowerCase()} ${NAMES.x[ax].toLowerCase()}`} onClick={() => anchorBoth(ax, ay)} />
              );
            }),
          )}
        </div>
      </div>

      <div className="axis">
        <div className="axis-head">
          <span>Across</span>
          <label className="check small" title="Fix the left and right edges instead of a position and a width">
            <input type="checkbox" checked={x.anchor === 'stretch'} onChange={(e) => set('x', reanchor(panel, placement, 'x', e.target.checked ? 'stretch' : 'start', aspect).x)} />
            Between edges
          </label>
        </div>
        <AxisFields axis={x} which="x" lengthPct={lengthOf('x')} canAuto={aspect !== undefined} otherIsAuto={y.anchor !== 'stretch' && y.size === 'auto'} onChange={(a) => set('x', a)} />
      </div>
      <div className="axis">
        <div className="axis-head">
          <span>Down</span>
          <label className="check small" title="Fix the top and bottom edges instead of a position and a height">
            <input type="checkbox" checked={y.anchor === 'stretch'} onChange={(e) => set('y', reanchor(panel, placement, 'y', e.target.checked ? 'stretch' : 'start', aspect).y)} />
            Between edges
          </label>
        </div>
        <AxisFields axis={y} which="y" lengthPct={lengthOf('y')} canAuto={aspect !== undefined} otherIsAuto={x.anchor !== 'stretch' && x.size === 'auto'} onChange={(a) => set('y', a)} />
      </div>
      <p className="muted small">
        ≈ {Math.round(rect.widthMm * 10) / 10} × {Math.round(rect.heightMm * 10) / 10} mm. Percentages are of the {panel.label.toLowerCase()}: 0–100 is the trimmed panel, beyond it the bleed.
      </p>
      {autoLabel && (
        <button className="link" onClick={() => onChange(null)}>
          Back to automatic
        </button>
      )}
    </div>
  );
}
