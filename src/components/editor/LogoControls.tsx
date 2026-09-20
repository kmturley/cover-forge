import { useAppDispatch, useAppState } from '../../context/AppContext';
import { BRAND_GROUPS, brandAspect, getBrand, type Brand } from '../../brands';
import { computeLogoPlacement } from '../../engine/logo';
import { PANEL_IDS } from '../../engine/resolve';
import type { LogoSettings } from '../../types/editor';
import type { PanelId } from '../../types/template';
import { NumberSlider } from './NumberSlider';

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
  const brand = getBrand(logo.brand);
  const rect = template.panels.find((p) => p.id === panel)!;

  const patch = (change: Partial<LogoSettings>, on: PanelId = panel) =>
    dispatch({ type: 'updatePanel', id: target, panel: on, patch: { logo: change } });
  const pl = brand ? computeLogoPlacement(template, rect, brandAspect(brand), logo) : null;

  return (
    <>
      <h2>Brand logo</h2>
      <div className="brand-groups">
        <button className={`brand-option none ${!brand ? 'selected' : ''}`} aria-pressed={!brand} onClick={() => patch({ brand: null })}>
          None
        </button>
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
      </div>

      {brand && pl && (
        <>
          <div className="field row">
            <input type="color" aria-label="Logo colour" value={logo.color} onChange={(e) => patch({ color: e.target.value })} />
            {[...SWATCHES, { label: 'Brand', value: `#${brand.hex}` }].map((s) => (
              <button key={s.label} onClick={() => patch({ color: s.value })} title={s.value}>
                {s.label}
              </button>
            ))}
          </div>
          <NumberSlider label="Logo size (width)" unit="mm" min={2} max={150} step={0.5} decimals={1} value={pl.widthMm} onChange={(widthMm) => patch({ widthMm })} />
          <NumberSlider label="Logo position X" unit="mm" min={Math.floor(-pl.widthMm)} max={Math.ceil(pl.area.widthMm)} step={0.1} decimals={1} value={pl.xMm} onChange={(xMm) => patch({ xMm })} />
          <NumberSlider label="Logo position Y" unit="mm" min={Math.floor(-pl.heightMm)} max={Math.ceil(pl.area.heightMm)} step={0.1} decimals={1} value={pl.yMm} onChange={(yMm) => patch({ yMm })} />
          <NumberSlider label="Logo rotation" unit="°" min={-180} max={180} step={0.1} decimals={1} value={logo.rotationDeg} onChange={(rotationDeg) => patch({ rotationDeg })} />
          <NumberSlider label="Logo opacity" unit="%" min={0} max={100} step={1} decimals={0} value={Math.round(logo.opacity * 100)} onChange={(v) => patch({ opacity: v / 100 })} />
          <div className="button-row">
            <button onClick={() => patch({ widthMm: null, xMm: null, yMm: null, rotationDeg: 0 })}>Reset logo placement</button>
            <button
              title="Show this logo on the front, spine and back (each keeps its own default size and position)"
              onClick={() => PANEL_IDS.filter((id) => id !== panel).forEach((id) => patch({ brand: logo.brand, color: logo.color, opacity: logo.opacity }, id))}
            >
              Use on all panels
            </button>
          </div>
        </>
      )}
      <p className="muted small">
        Brand marks are trademarks of their owners (icons via Simple Icons, CC0). Use them in line with each owner's guidelines
        {brand?.guidelines && (
          <>
            {' '}
            — <a href={brand.guidelines} target="_blank" rel="noreferrer">{brand.label} guidelines</a>
          </>
        )}
        .
      </p>
    </>
  );
}
