import { SPINE_VARIABLES, defaultCapHeightMm, defaultSpineTemplate, spineText } from '../../../engine/SpineTypography';
import { canvasPanel } from '../../../engine/layers/draw';
import { isDefaultId } from '../../../engine/layers/labels';
import type { TextLayer } from '../../../types/layers';
import { NumberSlider } from '../NumberSlider';
import { RotationOpacity } from './CommonFields';
import { FontPicker } from './FontPicker';
import { NumberField } from './NumberField';
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

      <div className="field">
        <span>Font</span>
        <FontPicker value={layer.fontFamily} used={ed.layers.filter((l) => l.type === 'text').map((l) => (l as TextLayer).fontFamily)} onPick={(fontFamily) => set({ fontFamily })} />
        {ed.layers.filter((l) => l.type === 'text').length > 1 && (
          <button
            className="link"
            onClick={() => ed.updateMany(ed.layers.filter((l) => l.type === 'text').map((l) => l.id), { fontFamily: layer.fontFamily })}
            title="Set this font on every text layer in this design, the spine title included"
          >
            Use this font on every text layer
          </button>
        )}
      </div>
      <label className="field">
        <span>Text colour</span>
        <input type="color" value={layer.color} onChange={(e) => set({ color: e.target.value }, 'color')} />
      </label>

      {layer.spineFit && (
        <>
          <h3>Fitted round the Branded dress</h3>
          <NumberField label="Keep clear at the start" unit="mm" step={0.5} decimals={1} min={0} value={layer.spineFit.startMm} onChange={(startMm) => set({ spineFit: { startMm } })} />
          <NumberSlider label="Size" unit="×" min={0.5} max={2} step={0.05} decimals={2} value={layer.spineFit.scale} onChange={(scale) => set({ spineFit: { scale } }, 'fit-scale')} />
          <label className="check small">
            <input type="checkbox" checked={layer.textCase === 'upper'} onChange={(e) => set({ textCase: e.target.checked ? 'upper' : 'none' })} />
            Print in capitals
          </label>
        </>
      )}
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
          <NumberSlider label="Letter spacing" unit="‰" min={-100} max={500} step={5} decimals={0} value={layer.letterSpacing} onChange={(letterSpacing) => set({ letterSpacing }, 'spacing')} />
          <NumberSlider label="Line height" unit="×" min={0.6} max={2} step={0.05} decimals={2} value={layer.lineHeight ?? 1.2} onChange={(lineHeight) => set({ lineHeight }, 'line-height')} />
          <h3>Outline and shadow</h3>
          <div className="field row">
            <input type="color" aria-label="Outline colour" value={layer.textStroke.color} onChange={(e) => set({ textStroke: { color: e.target.value } }, 'stroke-color')} />
            <span className="muted">Outline {layer.textStroke.widthMm > 0 ? `${layer.textStroke.widthMm} mm` : 'none'}</span>
          </div>
          <NumberSlider label="Outline width" unit="mm" min={0} max={3} step={0.1} decimals={1} value={layer.textStroke.widthMm} onChange={(widthMm) => set({ textStroke: { widthMm } }, 'stroke-width')} />
          <div className="field row">
            <input type="color" aria-label="Shadow colour" value={layer.shadow.color} onChange={(e) => set({ shadow: { color: e.target.value } }, 'shadow-color')} />
            <span className="muted">Shadow</span>
          </div>
          <NumberSlider label="Shadow blur" unit="mm" min={0} max={5} step={0.1} decimals={1} value={layer.shadow.blurMm} onChange={(blurMm) => set({ shadow: { blurMm } }, 'shadow-blur')} />
          <NumberSlider label="Shadow across" unit="mm" min={-5} max={5} step={0.1} decimals={1} value={layer.shadow.xMm} onChange={(xMm) => set({ shadow: { xMm } }, 'shadow-x')} />
          <NumberSlider label="Shadow down" unit="mm" min={-5} max={5} step={0.1} decimals={1} value={layer.shadow.yMm} onChange={(yMm) => set({ shadow: { yMm } }, 'shadow-y')} />
          <h3>Position and size of the box</h3>
          <PlacementControls placement={layer.placement} panel={panel} autoLabel={panelRect?.text ? 'Along the spine, as the title' : undefined} onChange={(placement) => set({ placement })} />
          <RotationOpacity layer={layer} ed={ed} />
        </>
      )}
    </>
  );
}
