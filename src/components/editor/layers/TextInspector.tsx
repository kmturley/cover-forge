import { SPINE_VARIABLES, defaultCapHeightMm, defaultSpineTemplate, spineText } from '../../../engine/SpineTypography';
import { FONTS } from '../../../engine/fonts';
import { canvasPanel } from '../../../engine/layers/draw';
import { isDefaultId } from '../../../engine/layers/labels';
import type { TextLayer } from '../../../types/layers';
import { NumberSlider } from '../NumberSlider';
import { RotationOpacity } from './CommonFields';
import { PlacementControls } from './PlacementControls';
import type { LayerEditor } from './useLayerEditor';

/**
 * Text. A spine's own title (the default spine text layer, with no placement) is fitted along the spine and its words
 * belong to the design (`{title}` for every item) or, under "This item", to the item. Any other text is set in a box
 * that is placed like every other layer: wrapped, sized to fit it, or at a height of its own.
 */
export function TextInspector({ layer, ed }: { layer: TextLayer; ed: LayerEditor }) {
  const { item, panelRect, template } = ed;
  const panel = panelRect ?? canvasPanel(template);
  const spineTitle = isDefaultId(layer.id) && !!panelRect?.text && layer.placement === null;
  const set = (p: Record<string, unknown>, key?: string) => ed.update(layer.id, p, key);
  const autoMm = panelRect?.text ? defaultCapHeightMm(panelRect, panelRect.text) : null;
  const shown = item ? spineText(item, { text: layer.text, textTemplate: spineTitle && !ed.isOverride ? layer.textTemplate : layer.text ? undefined : layer.textTemplate }) : '';

  return (
    <>
      {spineTitle && ed.isOverride ? (
        <>
          <label className="field">
            <span>Text (this item)</span>
            <input type="text" value={layer.text ?? layer.textTemplate ?? (item ? defaultSpineTemplate(item) : '')} onChange={(e) => set({ text: e.target.value }, 'text')} />
          </label>
          {layer.text !== undefined && <button onClick={() => set({ text: undefined })}>Use the design’s text</button>}
        </>
      ) : spineTitle ? (
        <label className="field">
          <span>Text (every item in this design)</span>
          <input type="text" value={layer.textTemplate ?? (item ? defaultSpineTemplate(item) : '')} onChange={(e) => set({ textTemplate: e.target.value }, 'text')} />
        </label>
      ) : (
        <label className="field">
          <span>Text</span>
          <textarea rows={2} value={layer.text ?? ''} onChange={(e) => set({ text: e.target.value }, 'text')} />
        </label>
      )}
      <p className="spine-vars">
        {SPINE_VARIABLES.map((v) => (
          <code key={v.name} title={v.label}>{`{${v.name}}`}</code>
        ))}
      </p>
      {item && <p className="muted small">Shows: “{shown}”</p>}

      <NumberSlider
        label={spineTitle ? 'Text height (shrinks to fit)' : 'Text height'}
        unit="mm"
        min={1.5}
        max={spineTitle ? 12 : 40}
        step={0.5}
        decimals={1}
        value={layer.textHeightMm ?? autoMm ?? 5}
        onChange={(textHeightMm) => set({ textHeightMm }, 'height')}
      />
      {layer.textHeightMm !== undefined && <button onClick={() => set({ textHeightMm: undefined })}>{spineTitle ? `Automatic size (${autoMm} mm for this template)` : 'Automatic: as large as fits the box'}</button>}

      <label className="field">
        <span>Font</span>
        <select value={layer.fontFamily} onChange={(e) => set({ fontFamily: e.target.value })}>
          {!FONTS.some(([v]) => v === layer.fontFamily) && <option value={layer.fontFamily}>Custom font</option>}
          {FONTS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Text colour</span>
        <input type="color" value={layer.color} onChange={(e) => set({ color: e.target.value }, 'color')} />
      </label>

      {spineTitle ? (
        <>
          <NumberSlider label="Text rotation" unit="°" min={-180} max={180} step={1} decimals={0} value={layer.textRotationDeg ?? 0} onChange={(v) => set({ textRotationDeg: v || undefined }, 'rotation')} />
          {!!layer.textRotationDeg && <p className="muted small">180° reverses the reading direction (e.g. bottom-to-top on a vertical spine).</p>}
          <p className="muted small">The title runs along the spine. <button className="link" onClick={() => set({ placement: { x: { anchor: 'center', offset: 50, size: 100 }, y: { anchor: 'center', offset: 50, size: 100 } } })}>Set it in a box instead</button></p>
        </>
      ) : (
        <>
          <div className="seg" role="group" aria-label="Alignment">
            {(['left', 'center', 'right'] as const).map((a) => (
              <button key={a} className={layer.align === a ? 'active' : ''} aria-pressed={layer.align === a} onClick={() => set({ align: a })}>
                {a[0].toUpperCase() + a.slice(1)}
              </button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Style">
            <button className={layer.weight >= 600 ? 'active' : ''} aria-pressed={layer.weight >= 600} onClick={() => set({ weight: layer.weight >= 600 ? 400 : 700 })}><b>Bold</b></button>
            <button className={layer.italic ? 'active' : ''} aria-pressed={layer.italic} onClick={() => set({ italic: !layer.italic })}><i>Italic</i></button>
          </div>
          <h3>Position and size of the box</h3>
          <PlacementControls placement={layer.placement} panel={panel} autoLabel={panelRect?.text ? 'Along the spine, as the title' : undefined} onChange={(placement) => set({ placement })} />
          <RotationOpacity layer={layer} ed={ed} />
        </>
      )}
    </>
  );
}
