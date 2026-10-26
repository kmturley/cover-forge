import { NumberSlider } from '../NumberSlider';
import type { Layer } from '../../../types/layers';
import type { LayerEditor } from './useLayerEditor';

/** Rotation and opacity, which every placed layer has. Drags are one undo step. */
export function RotationOpacity({ layer, ed, noRotation }: { layer: Layer; ed: LayerEditor; noRotation?: boolean }) {
  return (
    <>
      {!noRotation && (
        <NumberSlider label="Rotation" unit="°" min={-180} max={180} step={0.1} decimals={1} value={layer.rotationDeg} onChange={(rotationDeg) => ed.update(layer.id, { rotationDeg }, 'rotation')} />
      )}
      <NumberSlider label="Opacity" unit="%" min={0} max={100} step={1} decimals={0} value={Math.round(layer.opacity * 100)} onChange={(v) => ed.update(layer.id, { opacity: v / 100 }, 'opacity')} />
    </>
  );
}
