import { encodeBars, encodeQr } from '../../../codes/encode';
import { PATTERN_TOKENS, barcodeValue, fillPattern } from '../../../codes/pattern';
import { CODE_SAFETY_MM, codeAspect, computeCodePlacement } from '../../../engine/code';
import { rectToBox } from '../../../engine/box';
import { canvasPanel, codeSettingsOf } from '../../../engine/layers/draw';
import { CODE_LABELS } from '../../../engine/layers/labels';
import type { CodeKind } from '../../../types/editor';
import type { CodeLayer } from '../../../types/layers';
import { PlacementControls } from './PlacementControls';
import { RotationOpacity } from './CommonFields';
import type { LayerEditor } from './useLayerEditor';

const KINDS: CodeKind[] = ['none', 'qr', 'ean13', 'upca', 'code128'];

const QR_PRESETS = [
  { label: 'Launch in Steam', pattern: 'steam://run/{appId}' },
  { label: 'Steam store page', pattern: 'https://store.steampowered.com/app/{appId}' },
  { label: 'Web search', pattern: 'https://www.google.com/search?q={titleEncoded}' },
  { label: 'Title', pattern: '{title}' },
];

/** What a scanner should read: real product digits (see the note under the field), or an ID an inventory app can use. */
const BARCODE_PRESETS = [
  { label: 'Steam app ID', pattern: '{appId}', kinds: ['code128'] },
  { label: 'Steam launch link', pattern: 'steam://run/{appId}', kinds: ['code128'] },
  { label: 'Title text', pattern: '{title}', kinds: ['code128'] },
  { label: 'Generated number', pattern: '{title}', kinds: ['ean13', 'upca'] },
];

/** True when the user typed a full-length EAN/UPC whose last digit isn't the correct check digit. */
function typedCheckDigitWrong(text: string, encoded: string): boolean {
  const digits = text.replace(/\D/g, '');
  return digits.length === encoded.length && digits !== encoded;
}

/** QR code and barcode: what they say, how they look, and where they go. */
export function CodeInspector({ layer, ed }: { layer: CodeLayer; ed: LayerEditor }) {
  const { item, template } = ed;
  const panel = ed.panelRect ?? canvasPanel(template);
  const p = layer.params;
  const setParams = (params: Partial<typeof p>, key?: string) => ed.update(layer.id, { params }, key);
  const pl = computeCodePlacement(template, panel, codeSettingsOf(layer, panel));

  // What the code will actually contain for the selected item, so problems are visible before printing.
  let preview: string | null = null;
  let problem: string | null = null;
  if (item && p.kind !== 'none') {
    if (p.kind === 'qr') {
      const text = fillPattern(p.pattern, item);
      preview = text;
      if (!encodeQr(text)) problem = text ? 'Too much text for a QR code.' : 'Nothing to encode.';
    } else {
      const v = barcodeValue(p.kind, p.pattern, item);
      const bars = encodeBars(p.kind, v.value);
      preview = bars ? bars.text : v.value;
      if (!bars) problem = 'This value isn’t valid for that barcode type.';
      else if (!v.generated && p.kind !== 'code128' && typedCheckDigitWrong(fillPattern(p.pattern, item), bars.text)) problem = `That check digit doesn’t match; a scanner would read ${bars.text}. Use ${bars.text.length - 1} digits and it is added for you.`;
      else if (v.generated) preview += '  (generated: in-store range, not a registered product code)';
    }
  }

  return (
    <>
      <label className="field">
        <span>Type</span>
        <select value={p.kind} onChange={(e) => setParams({ kind: e.target.value as CodeKind })}>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {CODE_LABELS[k]}
            </option>
          ))}
        </select>
      </label>

      {p.kind !== 'none' && (
        <>
          <label className="field">
            <span>{p.kind === 'qr' ? 'Link or text' : p.kind === 'code128' ? 'Text' : 'Digits (or leave for a generated number)'}</span>
            <input type="text" value={p.pattern} onChange={(e) => setParams({ pattern: e.target.value }, 'pattern')} />
          </label>
          <p className="muted small">Tokens: {PATTERN_TOKENS.join(' ')}</p>
          <div className="button-row">
            {(p.kind === 'qr' ? QR_PRESETS : BARCODE_PRESETS.filter((b) => (b.kinds as string[]).includes(p.kind))).map((b) => (
              <button key={b.label} onClick={() => setParams({ pattern: b.pattern })}>
                {b.label}
              </button>
            ))}
          </div>
          {(p.kind === 'ean13' || p.kind === 'upca') && (
            <p className="muted small">
              Type a real {p.kind === 'ean13' ? 'EAN-13' : 'UPC-A'} from the product’s box and it prints exactly as a scanner expects. There is no free lookup from a
              title to its barcode, so without digits a number from the reserved in-store range is generated.
            </p>
          )}
          {preview !== null && <p className="code-preview" title={preview}>Encodes: {preview}</p>}
          {problem && <p className="error small">{problem}</p>}
          {pl && !pl.fits && <p className="warn small">Its box leaves too little room inside this panel’s safe area, so it won’t be printed. Make the box larger or move it onto the panel.</p>}

          <div className="field row">
            <input type="color" aria-label="Code colour" value={p.color} onChange={(e) => setParams({ color: e.target.value }, 'color')} />
            <span className="muted">Bars</span>
            <input type="color" aria-label="Code background colour" value={p.background} onChange={(e) => setParams({ background: e.target.value }, 'background')} />
            <span className="muted">Background</span>
          </div>
          <p className="muted small">The code is as large as fits inside its box (and the panel’s {CODE_SAFETY_MM} mm safe area), centred, keeping its proportions.</p>
          <h3>Position and size</h3>
          <PlacementControls
            placement={layer.placement}
            panel={panel}
            aspect={codeAspect(p.kind)}
            autoBox={pl ? rectToBox(panel, pl.box) : undefined}
            autoLabel="The standard size, in the bottom-right corner"
            onChange={(placement) => ed.update(layer.id, { placement })}
          />
          <RotationOpacity layer={layer} ed={ed} />
        </>
      )}
    </>
  );
}
