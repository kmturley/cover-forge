import { useState } from 'react';
import { targetDesignId, useAppDispatch, useAppState, useSelectedItem, type EditMode } from '../../context/AppContext';
import { DEFAULT_DESIGN_ID, DEFAULT_DESIGN_NAME, usersOf } from '../../engine/designs';
import type { PanelId } from '../../types/template';
import { NameModal } from './NameModal';

/** Which design the selected item uses (change it, or fork it), and whether edits go to the design or just this item. */
export function DesignBar({ panel }: { panel: PanelId }) {
  const state = useAppState();
  const { items, designs, editMode } = state;
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const [naming, setNaming] = useState<'fork' | 'rename' | null>(null);

  const designId = targetDesignId(state);
  const current = designs.find((d) => d.id === designId);
  const name = current?.name ?? DEFAULT_DESIGN_NAME;
  const isDefault = designId === DEFAULT_DESIGN_ID;
  const users = usersOf(items, designs, designId).length;
  const modes: { id: EditMode; label: string }[] = [
    { id: 'shared', label: 'Design' },
    { id: 'override', label: 'This item' },
  ];
  const confirmThen = (message: string, action: () => void) => window.confirm(message) && action();

  return (
    <>
      <div className="design-row">
        <label htmlFor="design-select">Design</label>
        <select id="design-select" value={designId} disabled={!item} onChange={(e) => item && dispatch({ type: 'assignDesign', items: [item.id], design: e.target.value === DEFAULT_DESIGN_ID ? null : e.target.value })}>
          <option value={DEFAULT_DESIGN_ID}>{DEFAULT_DESIGN_NAME}</option>
          {designs.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <button disabled={!item} onClick={() => setNaming('fork')} title={isDefault ? 'New design that starts as Default; only what you change differs' : `New design copied from “${name}”`}>
          Fork…
        </button>
      </div>
      <p className="scope-note">
        Used by {users} item{users === 1 ? '' : 's'}.{isDefault ? ' Every design builds on Default.' : ''}
      </p>
      <div className="scope-tools">
        <div className="seg" role="group" aria-label="Edit scope">
          {modes.map((m) => (
            <button key={m.id} className={m.id === editMode ? 'active' : ''} aria-pressed={m.id === editMode} disabled={m.id === 'override' && !item} onClick={() => dispatch({ type: 'setEditMode', mode: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        <details className="menu">
          <summary>More…</summary>
          <div className="menu-list" onClick={(e) => e.currentTarget.parentElement?.removeAttribute('open')}>
            {!isDefault && <button onClick={() => setNaming('rename')}>Rename “{name}”</button>}
            <button onClick={() => dispatch({ type: 'clearDesign', design: designId, panel })}>Reset this panel in “{name}”</button>
            <button onClick={() => confirmThen(`Reset every panel of “${name}”?`, () => dispatch({ type: 'clearDesign', design: designId }))}>Reset all of “{name}”</button>
            {!isDefault && (
              <button onClick={() => confirmThen(`Delete “${name}”? Its ${users} item${users === 1 ? '' : 's'} go back to Default.`, () => dispatch({ type: 'deleteDesign', id: designId }))}>Delete “{name}”</button>
            )}
          </div>
        </details>
      </div>
      <p className="scope-note">
        {editMode === 'override' && item ? `Edits apply to “${item.title}” only.` : `Edits change “${name}” for everything using it.`}
      </p>
      {naming === 'fork' && item && (
        <NameModal
          title="Fork design"
          initial={isDefault ? `Design ${designs.length + 2}` : `${name} copy`}
          confirm="Fork"
          onClose={() => setNaming(null)}
          onDone={(n) => dispatch({ type: 'forkDesign', id: `design-${Date.now().toString(36)}`, name: n, from: designId, items: [item.id] })}
        />
      )}
      {naming === 'rename' && <NameModal title="Rename design" initial={name} confirm="Rename" onClose={() => setNaming(null)} onDone={(n) => dispatch({ type: 'renameDesign', id: designId, name: n })} />}
    </>
  );
}
