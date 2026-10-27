import { targetDesignId, useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { panelHasOverride } from '../../engine/resolve';
import { designHasPanel } from '../../engine/designs';
import { DesignBar } from './DesignBar';
import { CaseBar } from '../templates/CaseBar';
import { LayerPanel } from './layers/LayerPanel';
import { useEditScope } from './useEditScope';

/** The right sidebar: which case and design, which panel to work on, and that panel's layers. */
export function PanelControls() {
  const state = useAppState();
  const { template } = state;
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const { tab, isOverride } = useEditScope();
  const grouped = !isOverride || !item;
  // A layer across the panels is only a choice when there is more than one panel to span.
  const designable = template.panels.filter((p) => !p.follows);
  const tabs: { id: typeof tab; label: string }[] = [...designable.map((p) => ({ id: p.id as typeof tab, label: p.label })), ...(designable.length > 1 ? [{ id: 'canvas' as const, label: 'All panels' }] : [])];

  return (
    <section className="controls">
      <div className="controls-head">
        <CaseBar />
        <DesignBar />
        <div className="seg wide" role="tablist" aria-label="Panel to edit">
          {tabs.map((t) => {
            const marked = grouped ? designHasPanel(state.shared, state.designs, targetDesignId(state), t.id) : panelHasOverride(item, t.id);
            return (
              <button key={t.id} role="tab" aria-selected={t.id === tab} className={t.id === tab ? 'active' : ''} onClick={() => dispatch({ type: 'selectPanel', panel: t.id })}>
                {t.label}
                {marked && <span className="dot" title={grouped ? 'This design has its own settings here' : 'This item overrides its design here'} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="controls-body">
        {item ? (
          <>
            <LayerPanel />
            {isOverride && tab !== 'canvas' && (
              <div className="override-actions">
                <button disabled={!panelHasOverride(item, tab)} onClick={() => dispatch({ type: 'clearOverrides', id: item.id, panel: tab })}>
                  Remove overrides — use design
                </button>
              </div>
            )}
          </>
        ) : (
          <p className="muted">Add a game to edit its panels.</p>
        )}
      </div>
    </section>
  );
}
