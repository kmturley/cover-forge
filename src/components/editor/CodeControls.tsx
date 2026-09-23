import { useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { encodeBars, encodeQr } from '../../codes/encode';
import { PATTERN_TOKENS, barcodeValue, fillPattern } from '../../codes/pattern';
import { computeCodePlacement } from '../../engine/code';
import type { CodeKind, CodeSettings } from '../../types/editor';
import type { PanelId } from '../../types/template';
import { NumberSlider } from './NumberSlider';

const KINDS: { id: CodeKind; label: string }[] = [
  { id: 'none', label: 'None' },
  { id: 'qr', label: 'QR code' },
  { id: 'ean13', label: 'Barcode · EAN-13' },
  { id: 'upca', label: 'Barcode · UPC-A' },
  { id: 'code128', label: 'Barcode · Code 128' },
];

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

interface Props {
  panel: PanelId;
  /** null = the shared layer, otherwise the selected item's id. */
  target: string | null;
  code: CodeSettings;
}

/** True when the user typed a full-length EAN/UPC whose last digit isn't the correct check digit. */
function typedCheckDigitWrong(text: string, encoded: string): boolean {
  const digits = text.replace(/\D/g, '');
  return digits.length === encoded.length && digits !== encoded;
}

/** QR code / barcode controls for one panel. Edits go to the shared layer or the item's override. */
export function CodeControls({ panel, target, code }: Props) {
  const { template } = useAppState();
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const rect = template.panels.find((p) => p.id === panel)!;
  const patch = (change: Partial<CodeSettings>) => dispatch({ type: 'updatePanel', id: target, panel, patch: { code: change } });
  const pl = computeCodePlacement(template, rect, code);

  // What the code will actually contain for the selected item, so problems are visible before printing.
  let preview: string | null = null;
  let problem: string | null = null;
  if (item && code.kind !== 'none') {
    if (code.kind === 'qr') {
      const text = fillPattern(code.pattern, item);
      preview = text;
      if (!encodeQr(text)) problem = text ? 'Too much text for a QR code.' : 'Nothing to encode.';
    } else {
      const v = barcodeValue(code.kind, code.pattern, item);
      const bars = encodeBars(code.kind, v.value);
      preview = bars ? bars.text : v.value;
      if (!bars) problem = 'This value isn’t valid for that barcode type.';
      else if (!v.generated && code.kind !== 'code128' && typedCheckDigitWrong(fillPattern(code.pattern, item), bars.text))
        problem = `That check digit doesn’t match; a scanner would read ${bars.text}. Use ${bars.text.length - 1} digits and it is added for you.`;
      else if (v.generated) preview += '  (generated: in-store range, not a registered product code)';
    }
  }

  return (
    <>
      <label className="field">
        <span>Type</span>
        <select value={code.kind} onChange={(e) => patch({ kind: e.target.value as CodeKind })}>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>
              {k.label}
            </option>
          ))}
        </select>
      </label>

      {code.kind !== 'none' && pl && (
        <>
          <label className="field">
            <span>{code.kind === 'qr' ? 'Link or text' : code.kind === 'code128' ? 'Text' : 'Digits (or leave for a generated number)'}</span>
            <input type="text" value={code.pattern} onChange={(e) => patch({ pattern: e.target.value })} />
          </label>
          <p className="muted small">
            Tokens: {PATTERN_TOKENS.join(' ')}
          </p>
          <div className="button-row">
            {(code.kind === 'qr' ? QR_PRESETS : BARCODE_PRESETS.filter((p) => (p.kinds as string[]).includes(code.kind))).map((p) => (
              <button key={p.label} onClick={() => patch({ pattern: p.pattern })}>
                {p.label}
              </button>
            ))}
          </div>
          {(code.kind === 'ean13' || code.kind === 'upca') && (
            <p className="muted small">
              Type a real {code.kind === 'ean13' ? 'EAN-13' : 'UPC-A'} from the product’s box and it prints exactly as a scanner expects. There is no free
              lookup from a title to its barcode, so without digits a number from the reserved in-store range is generated.
            </p>
          )}
          {preview !== null && <p className="code-preview" title={preview}>Encodes: {preview}</p>}
          {problem && <p className="error small">{problem}</p>}
          {!pl.fits && <p className="warn small">Doesn’t fit inside this panel at this size, so it won’t be printed. Make it smaller or use a larger panel.</p>}

          <div className="field row">
            <input type="color" aria-label="Code colour" value={code.color} onChange={(e) => patch({ color: e.target.value })} />
            <span className="muted">Bars</span>
            <input type="color" aria-label="Code background colour" value={code.background} onChange={(e) => patch({ background: e.target.value })} />
            <span className="muted">Background</span>
          </div>
          <NumberSlider label="Code width" unit="mm" min={4} max={150} step={0.5} decimals={1} value={pl.widthMm} onChange={(widthMm) => patch({ widthMm })} />
          <NumberSlider label="Code position X" unit="mm" min={Math.floor(-pl.widthMm)} max={Math.ceil(pl.area.widthMm)} step={0.1} decimals={1} value={pl.xMm} onChange={(xMm) => patch({ xMm })} />
          <NumberSlider label="Code position Y" unit="mm" min={Math.floor(-pl.heightMm)} max={Math.ceil(pl.area.heightMm)} step={0.1} decimals={1} value={pl.yMm} onChange={(yMm) => patch({ yMm })} />
          <NumberSlider label="Code rotation" unit="°" min={-180} max={180} step={0.1} decimals={1} value={code.rotationDeg} onChange={(rotationDeg) => patch({ rotationDeg })} />
          <NumberSlider label="Code opacity" unit="%" min={0} max={100} step={1} decimals={0} value={Math.round(code.opacity * 100)} onChange={(v) => patch({ opacity: v / 100 })} />
          <button onClick={() => patch({ widthMm: null, xMm: null, yMm: null, rotationDeg: 0 })}>Reset code placement</button>
        </>
      )}
    </>
  );
}
