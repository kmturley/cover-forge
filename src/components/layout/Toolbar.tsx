import { useAppDispatch, useAppState } from '../../context/AppContext';
import { SPINE_OPTIONS, spineName } from '../../templates';
import type { Region } from '../../types/template';

export function Toolbar({ onExport }: { onExport: () => void }) {
  const { region, template, showGuides, view, styleOverlay } = useAppState();
  const dispatch = useAppDispatch();
  return (
    <header className="toolbar">
      <strong className="brand">CoverForge</strong>
      <label>
        Region
        <select value={region} onChange={(e) => dispatch({ type: 'setRegion', region: e.target.value as Region })}>
          <option value="US">US</option>
          <option value="EU">EU</option>
        </select>
      </label>
      <label>
        Template
        <select value="bluray" disabled>
          <option value="bluray">Blu-ray Keepcase</option>
        </select>
      </label>
      <label>
        Spine
        <select value={template.spineMm} onChange={(e) => dispatch({ type: 'setSpine', spineMm: Number(e.target.value) })}>
          {SPINE_OPTIONS[region].map((o) => (
            <option key={o.mm} value={o.mm}>
              {spineName(o)}
            </option>
          ))}
        </select>
      </label>
      <label>
        Style
        <select value={styleOverlay} onChange={(e) => dispatch({ type: 'setStyleOverlay', style: e.target.value as 'clean' })}>
          <option value="clean">Clean</option>
          <option value="digital" disabled>
            Digital (soon)
          </option>
          <option value="retro" disabled>
            Retro wear (soon)
          </option>
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
