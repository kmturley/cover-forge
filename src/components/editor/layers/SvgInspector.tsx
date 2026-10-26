import { SVG_PRESETS, SVG_VARIABLES, fillSvg, sanitizeSvg, svgImageUrl } from '../../../engine/svgTemplate';
import { canvasPanel, svgLayerAspect } from '../../../engine/layers/draw';
import type { SvgLayer } from '../../../types/layers';
import { PlacementControls } from './PlacementControls';
import { RotationOpacity } from './CommonFields';
import type { LayerEditor } from './useLayerEditor';

/**
 * A custom graphic: SVG you write or paste, with `{variables}` filled in for each item. It is drawn as a picture, so it
 * can't run script or load anything from the web; anything like that is removed when it is drawn.
 */
export function SvgInspector({ layer, ed }: { layer: SvgLayer; ed: LayerEditor }) {
  const { item, template } = ed;
  const panel = ed.panelRect ?? canvasPanel(template);
  const svg = layer.params.svg;
  const filled = item ? fillSvg(svg, item) : svg;
  const clean = sanitizeSvg(filled);
  const changed = clean !== null && clean !== filled.trim().replace(/^<\?xml[^>]*\?>\s*/i, '').replace(/<!--[\s\S]*?-->/g, '');
  const url = item && clean ? svgImageUrl(svg, item) : null;
  const aspect = item ? (svgLayerAspect(layer, item) ?? undefined) : undefined;

  return (
    <>
      <div className="button-row" role="group" aria-label="Starting points">
        {SVG_PRESETS.map((p) => (
          <button key={p.label} onClick={() => ed.update(layer.id, { params: { svg: p.svg } })}>
            {p.label}
          </button>
        ))}
      </div>
      <label className="field">
        <span>SVG</span>
        <textarea className="code-area" rows={8} spellCheck={false} aria-label="SVG source" value={svg} onChange={(e) => ed.update(layer.id, { params: { svg: e.target.value } }, 'svg')} />
      </label>
      <p className="spine-vars">
        {SVG_VARIABLES.map((v) => (
          <code key={v}>{`{${v}}`}</code>
        ))}
      </p>
      {svg.trim() !== '' && clean === null && <p className="error small">That isn’t an SVG that can be drawn: it must start with {'<svg'}, end with {'</svg>'}, stay under 20,000 characters and have no entity declarations.</p>}
      {changed && <p className="warn small">Parts that could run script or load from the web were removed.</p>}
      {url && <img className="svg-preview" src={url} alt="Preview" />}
      <p className="muted small">The graphic is drawn as large as fits its box, centred, keeping its shape. Colours and fonts are whatever the SVG says; fonts only work if they are installed on the device that opens the file.</p>
      <h3>Position and size</h3>
      <PlacementControls placement={layer.placement} panel={panel} aspect={aspect} autoLabel="The whole panel" onChange={(placement) => ed.update(layer.id, { placement })} />
      <RotationOpacity layer={layer} ed={ed} />
    </>
  );
}
