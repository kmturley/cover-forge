import { isDefaultId, layerName } from '../../../engine/layers/labels';
import type { Layer } from '../../../types/layers';
import { CodeInspector } from './CodeInspector';
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
      <div className="inspector-head">
        <input type="text" aria-label="Layer name" placeholder={layerName({ ...layer, name: undefined })} value={layer.name ?? ''} onChange={(e) => ed.update(layer.id, { name: e.target.value }, 'name')} />
        <label className="check small" title="Show or hide this layer">
          <input type="checkbox" checked={layer.visible} onChange={(e) => ed.update(layer.id, { visible: e.target.checked })} />
          Shown
        </label>
      </div>
      {layer.type === 'shape' && <ShapeInspector key={layer.id} layer={layer} ed={ed} />}
      {layer.type === 'image' && <ImageInspector key={layer.id} layer={layer} ed={ed} />}
      {layer.type === 'text' && <TextInspector key={layer.id} layer={layer} ed={ed} />}
      {layer.type === 'generated' && <CodeInspector key={layer.id} layer={layer} ed={ed} />}
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
