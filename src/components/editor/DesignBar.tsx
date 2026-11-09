import { useState } from 'react';
import { targetDesignId, useAppDispatch, useAppState, useSelectedItem, type EditMode } from '../../context/AppContext';
import { DEFAULT_DESIGN_ID, DEFAULT_DESIGN_NAME } from '../../engine/designs';
import { LANDSCAPE, TURNABLE, turnsOf } from '../../engine/layers/turn';
import { useEditScope } from './useEditScope';
import { NameModal } from './NameModal';

const NEW_DESIGN = '__new__';

/** Which design the selected item uses (change it, or start a new one from it), and whether edits go to the design or just this item. */
export function DesignBar() {
  const state = useAppState();
  const { designs, editMode } = state;
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const [naming, setNaming] = useState<'fork' | null>(null);
  const { isOverride } = useEditScope();

  const designId = targetDesignId(state);
  const current = designs.find((d) => d.id === designId);
  const name = current?.name ?? DEFAULT_DESIGN_NAME;
  const isDefault = designId === DEFAULT_DESIGN_ID;
  const modes: { id: EditMode; label: string }[] = [
    { id: 'shared', label: 'All media' },
    { id: 'override', label: 'This media' },
  ];

  const turns = turnsOf({ item, shared: state.shared, designs });
  const landscape = !!turns.front || !!turns.back;
  const canTurn = TURNABLE.every((id) => state.template.panels.some((p) => p.id === id && !p.follows));
  /** Turns the front and back, or back, for the design (or just this item, as the scope says). */
  const orient = (on: boolean) => {
    if (!item) return;
    for (const id of TURNABLE as ('front' | 'back')[]) {
      dispatch({ type: 'updatePanel', id: isOverride ? item.id : null, design: designId, panel: id, patch: { turn: on ? LANDSCAPE[id] : 0 } });
    }
  };
  return (
    <>
      <div className="design-row">
        <label htmlFor="design-select">Design</label>
        <select
          id="design-select"
          value={designId}
          disabled={!item}
          onChange={(e) => {
            if (!item) return;
            if (e.target.value === NEW_DESIGN) setNaming('fork');
            else dispatch({ type: 'assignDesign', items: [item.id], design: e.target.value === DEFAULT_DESIGN_ID ? null : e.target.value });
          }}
        >
          <option value={DEFAULT_DESIGN_ID}>{DEFAULT_DESIGN_NAME}</option>
          {designs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          <option value={NEW_DESIGN}>+ New Design</option>
        </select>
      </div>
      <div className="scope-tools">
        <span className="scope-label" id="scope-label">Applies to:</span>
        <div className="seg" role="group" aria-labelledby="scope-label">
          {modes.map((m) => (
            <button key={m.id} className={m.id === editMode ? 'active' : ''} aria-pressed={m.id === editMode} disabled={m.id === 'override' && !item} onClick={() => dispatch({ type: 'setEditMode', mode: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {canTurn && (
        <div className="scope-tools">
          <span className="scope-label" id="orientation-label">Layout:</span>
          <div className="seg" role="group" aria-labelledby="orientation-label">
            <button className={landscape ? '' : 'active'} aria-pressed={!landscape} disabled={!item} onClick={() => orient(false)}>Portrait</button>
            <button className={landscape ? 'active' : ''} aria-pressed={landscape} disabled={!item} onClick={() => orient(true)}>Landscape</button>
          </div>
        </div>
      )}
      {landscape && <p className="scope-note">The front and back are turned for a landscape box. Their layers can’t be dragged on the canvas; use the position fields.</p>}
      {editMode === 'override' && item && <p className="scope-note">Edits apply to “{item.title}” only.</p>}
      {naming === 'fork' && item && (
        <NameModal
          title="New design"
          initial={isDefault ? `Design ${designs.length + 2}` : `${name} copy`}
          confirm="Create"
          onClose={() => setNaming(null)}
          onDone={(n) => dispatch({ type: 'forkDesign', id: `design-${Date.now().toString(36)}`, name: n, from: designId, items: [item.id] })}
        />
      )}
    </>
  );
}
