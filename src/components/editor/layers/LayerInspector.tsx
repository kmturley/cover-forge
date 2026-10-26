import { isDefaultId, layerName } from '../../../engine/layers/labels';
import type { Layer } from '../../../types/layers';
import { CodeInspector } from './CodeInspector';
import { SvgInspector } from './SvgInspector';
import { ImageInspector } from './ImageInspector';
import { ShapeInspector } from './ShapeInspector';
import { TextInspector } from './TextInspector';
import type { LayerEditor } from './useLayerEditor';

/** The controls for the selected layer: what it is (by type), then where it is. */
export function LayerInspector({ layer, ed }: { layer: Layer; ed: LayerEditor }) {
  const own = ed.touched.has(layer.id);
  const isDefault = isDefaultId(layer.id);
  return (
    <section className="inspector" aria-label={`${layerName(layer)} settings`}>
      {layer.type === 'shape' && <ShapeInspector key={layer.id} layer={layer} ed={ed} />}
      {layer.type === 'image' && <ImageInspector key={layer.id} layer={layer} ed={ed} />}
      {layer.type === 'text' && <TextInspector key={layer.id} layer={layer} ed={ed} />}
      {layer.type === 'generated' && layer.generator === 'code' && <CodeInspector key={layer.id} layer={layer} ed={ed} />}
      {layer.type === 'generated' && layer.generator === 'svg' && <SvgInspector key={layer.id} layer={layer} ed={ed} />}
      <div className="inspector-foot">
        {own && isDefault && (
          <button onClick={() => ed.reset(layer.id)} title="Forget every change here to this layer">
            {ed.isOverride ? 'Use the design’s version' : 'Back to the default'}
          </button>
        )}
        <button onClick={() => ed.remove(layer.id)}>Remove layer</button>
      </div>
    </section>
  );
}
