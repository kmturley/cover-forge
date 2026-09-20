import { useAppDispatch, useAppState } from '../../context/AppContext';
import { TEMPLATE_DEFS, regionsOf, variantsFor } from '../../templates';
import type { Region, TemplateKind } from '../../types/template';
import type { StyleOverlay } from '../../types/editor';

export function Toolbar({ onExport }: { onExport: () => void }) {
  const { templateKind, region, variantId, showGuides, view, styleOverlay } = useAppState();
  const regions = regionsOf(templateKind);
  const variants = variantsFor(templateKind, region);
  const dispatch = useAppDispatch();
  return (
    <header className="toolbar">
      <strong className="brand">CoverForge</strong>
      <label>
        Template
        <select value={templateKind} onChange={(e) => dispatch({ type: 'setTemplate', kind: e.target.value as TemplateKind })}>
          {(['Cases', 'Boxes', 'Labels & cards'] as const).map((group) => (
            <optgroup key={group} label={group}>
              {TEMPLATE_DEFS.filter((d) => d.group === group).map((d) => (
                <option key={d.kind} value={d.kind}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {regions.length > 1 && (
        <label>
          Region
          <select value={region} onChange={(e) => dispatch({ type: 'setRegion', region: e.target.value as Region })}>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
      )}
      {variants.length > 1 && (
        <label>
          Size
          <select value={variantId} onChange={(e) => dispatch({ type: 'setVariant', id: e.target.value })}>
            {variants.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Style
        <select value={styleOverlay} onChange={(e) => dispatch({ type: 'setStyleOverlay', style: e.target.value as StyleOverlay })}>
          <option value="clean">Clean</option>
          <option value="digital">Digital / Official</option>
          <option value="retro">Scanned / Retro wear</option>
        </select>
      </label>
      <label className="check">
        <input type="checkbox" checked={showGuides} onChange={(e) => dispatch({ type: 'setShowGuides', show: e.target.checked })} />
        Guides
      </label>
      <div className="seg" role="group" aria-label="View">
        <button className={view === '2d' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: '2d' })}>
          2D
        </button>
        <button className={view === '3d' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: '3d' })}>
          3D
        </button>
      </div>
      <button className="primary" onClick={onExport}>
        Export…
      </button>
    </header>
  );
}
