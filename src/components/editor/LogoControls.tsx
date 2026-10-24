import { useAppDispatch, useAppState } from '../../context/AppContext';
import { BRAND_GROUPS, LOGOS, getMark, type Brand, type Logo } from '../../brands';
import { computeLogoPlacement } from '../../engine/logo';
import type { LogoSettings } from '../../types/editor';
import type { PanelId } from '../../types/template';
import { NumberSlider } from './NumberSlider';
import { BoxControls } from './BoxControls';
import { rectToBox } from '../../engine/box';

const SWATCHES = [
  { label: 'White', value: '#ffffff' },
  { label: 'Black', value: '#000000' },
];

function BrandIcon({ brand }: { brand: Brand }) {
  const [x0, y0, x1, y1] = brand.bbox;
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} aria-hidden="true" fill="currentColor">
      <path d={brand.path} />
    </svg>
  );
}

/** Flat preview of a supplied logo: each layer in its own colour (a gradient shows as its average), the rest in the text colour. */
function LogoIcon({ logo }: { logo: Logo }) {
  const [x0, y0, x1, y1] = logo.bbox;
  return (
    <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} aria-hidden="true" fill="currentColor" fillRule={logo.evenodd ? 'evenodd' : 'nonzero'}>
      {logo.layers.map((l, i) => (
        <path key={i} d={l.d} transform={`translate(${l.offset[0]} ${l.offset[1]})`} fill={l.fill ?? 'currentColor'} {...(l.stroke !== undefined && { stroke: l.stroke ?? 'currentColor', strokeWidth: l.strokeWidth ?? 1 })} />
      ))}
    </svg>
  );
}

interface Props {
  panel: PanelId;
  /** null = the shared layer, otherwise the selected item's id. */
  target: string | null;
  logo: LogoSettings;
}

/** Brand-logo controls for one panel. Edits go to the shared layer or the item's override, like everything else. */
export function LogoControls({ panel, target, logo }: Props) {
  const { template } = useAppState();
  const dispatch = useAppDispatch();
  const mark = getMark(logo.brand);
  const rect = template.panels.find((p) => p.id === panel)!;

  const patch = (change: Partial<LogoSettings>) => dispatch({ type: 'updatePanel', id: target, panel, patch: { logo: change } });
  const pl = mark ? computeLogoPlacement(template, rect, mark.aspect, logo) : null;

  return (
    <>
      <div className="brand-groups">
        {BRAND_GROUPS.map((g) => (
          <div key={g.category}>
            <p className="group-label">{g.label}</p>
            <div className="brands">
              {g.brands.map((b) => (
                <button key={b.id} className={`brand-option ${b.id === logo.brand ? 'selected' : ''}`} title={b.label} aria-label={b.label} aria-pressed={b.id === logo.brand} onClick={() => patch({ brand: b.id })}>
                  <BrandIcon brand={b} />
                </button>
              ))}
            </div>
          </div>
        ))}
        <div>
          <p className="group-label">Template logos</p>
          <div className="brands">
            {LOGOS.map((l) => (
              <button key={l.id} className={`brand-option logo-option ${l.id === logo.brand ? 'selected' : ''}`} title={l.label} aria-label={l.label} aria-pressed={l.id === logo.brand} onClick={() => patch({ brand: l.id })}>
                <LogoIcon logo={l} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {mark && pl && (
        <>
          <div className="field row">
            <input type="color" aria-label="Logo colour" value={logo.color} onChange={(e) => patch({ color: e.target.value })} />
            {[...SWATCHES, ...(mark.kind === 'brand' ? [{ label: 'Brand', value: `#${mark.brand.hex}` }] : [])].map((s) => (
              <button key={s.label} onClick={() => patch({ color: s.value })} title={s.value}>
                {s.label}
              </button>
            ))}
          </div>
          <p className="muted small">The logo is as large as fits inside its box, centred, keeping its shape.</p>
          <BoxControls what="Logo" box={logo.box ?? rectToBox(rect, pl.box)} overhang={50} onChange={(box) => patch({ box })} />
          <NumberSlider label="Logo rotation" unit="°" min={-180} max={180} step={0.1} decimals={1} value={logo.rotationDeg} onChange={(rotationDeg) => patch({ rotationDeg })} />
          <NumberSlider label="Logo opacity" unit="%" min={0} max={100} step={1} decimals={0} value={Math.round(logo.opacity * 100)} onChange={(v) => patch({ opacity: v / 100 })} />
          <button onClick={() => patch({ box: null, rotationDeg: 0 })}>Reset logo placement</button>
        </>
      )}
      <p className="muted small">
        Brand marks are trademarks of their owners (icons via Simple Icons, CC0). Use them in line with each owner's guidelines
        {mark?.kind === 'brand' && mark.brand.guidelines && (
          <>
            {' '}
            — <a href={mark.brand.guidelines} target="_blank" rel="noreferrer">{mark.brand.label} guidelines</a>
          </>
        )}
        .
      </p>
    </>
  );
}
