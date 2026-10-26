import { NumberSlider } from '../NumberSlider';
import type { ShapeLayer } from '../../../types/layers';
import { canvasPanel } from '../../../engine/layers/draw';
import { FillControls } from './FillControls';
import { PlacementControls } from './PlacementControls';
import { RotationOpacity } from './CommonFields';
import type { LayerEditor } from './useLayerEditor';

/** A filled and/or outlined rectangle or ellipse: a colour block, a frame, a badge background. */
export function ShapeInspector({ layer, ed }: { layer: ShapeLayer; ed: LayerEditor }) {
  const panel = ed.panelRect ?? canvasPanel(ed.template);
  const stroke = (s: Partial<ShapeLayer['stroke']>) => ed.update(layer.id, { stroke: s }, `stroke-${Object.keys(s)[0]}`);
  return (
    <>
      {layer.shape === 'path' ? (
        <p className="muted small">An outline of its own. Resize and move it under Position and size.</p>
      ) : (
        <div className="seg" role="group" aria-label="Shape">
          {(['rect', 'ellipse'] as const).map((s) => (
            <button key={s} className={layer.shape === s ? 'active' : ''} aria-pressed={layer.shape === s} onClick={() => ed.update(layer.id, { shape: s })}>
              {s === 'rect' ? 'Rectangle' : 'Ellipse'}
            </button>
          ))}
        </div>
      )}
      <FillControls fill={layer.fill} onChange={(fill) => ed.update(layer.id, { fill }, 'fill')} />
      <h3>Outline</h3>
      <div className="field row">
        <input type="color" aria-label="Outline colour" value={layer.stroke.color} onChange={(e) => stroke({ color: e.target.value })} />
        <span className="muted">{layer.stroke.widthMm > 0 ? layer.stroke.color : 'No outline'}</span>
      </div>
      <NumberSlider label="Outline width" unit="mm" min={0} max={5} step={0.1} decimals={1} value={layer.stroke.widthMm} onChange={(widthMm) => stroke({ widthMm })} />
      <NumberSlider label="Outline inset from the edge" unit="mm" min={0} max={15} step={0.5} decimals={1} value={layer.stroke.insetMm} onChange={(insetMm) => stroke({ insetMm })} />
      <h3>Position and size</h3>
      <PlacementControls placement={layer.placement} panel={panel} autoLabel="The whole panel, with its bleed" onChange={(placement) => ed.update(layer.id, { placement })} />
      <RotationOpacity layer={layer} ed={ed} />
    </>
  );
}
