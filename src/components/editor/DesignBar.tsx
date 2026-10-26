import { useRef, useState } from 'react';
import { targetDesignId, useAppDispatch, useAppState, useSelectedItem, type EditMode } from '../../context/AppContext';
import { DEFAULT_DESIGN_ID, DEFAULT_DESIGN_NAME, usersOf } from '../../engine/designs';
import { itemHasOverrides } from '../../engine/resolve';
import { readDesignFile, saveDesignFile } from '../../context/designFile';
import { PresetModal } from './PresetModal';
import type { PanelId } from '../../types/template';
import { NameModal } from './NameModal';

const NEW_DESIGN = '__new__';

/** Which design the selected item uses (change it, or start a new one from it), and whether edits go to the design or just this item. */
export function DesignBar({ panel }: { panel: PanelId | 'canvas' }) {
  const state = useAppState();
  const { items, designs, editMode } = state;
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const [naming, setNaming] = useState<'fork' | 'rename' | 'save' | null>(null);
  const [presets, setPresets] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  const designId = targetDesignId(state);
  const current = designs.find((d) => d.id === designId);
  const name = current?.name ?? DEFAULT_DESIGN_NAME;
  const isDefault = designId === DEFAULT_DESIGN_ID;
  const users = usersOf(items, designs, designId).length;
  const modes: { id: EditMode; label: string }[] = [
    { id: 'shared', label: 'All items' },
    { id: 'override', label: 'This item' },
  ];
  const confirmThen = (message: string, action: () => void) => window.confirm(message) && action();

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
      <p className="scope-note">
        Used by {users} item{users === 1 ? '' : 's'}.{isDefault ? ' Every design builds on Default.' : ''}
      </p>
      <div className="scope-tools">
        <span className="scope-label" id="scope-label">Applies to:</span>
        <div className="seg" role="group" aria-labelledby="scope-label">
          {modes.map((m) => (
            <button key={m.id} className={m.id === editMode ? 'active' : ''} aria-pressed={m.id === editMode} disabled={m.id === 'override' && !item} onClick={() => dispatch({ type: 'setEditMode', mode: m.id })}>
              {m.label}
            </button>
          ))}
        </div>
        <details className="menu">
          <summary>More…</summary>
          <div className="menu-list" onClick={(e) => e.currentTarget.parentElement?.removeAttribute('open')}>
            <button disabled={!item} onClick={() => setPresets(true)}>New design from a preset…</button>
            {item && itemHasOverrides(item) && <button onClick={() => setNaming('save')}>Save this item’s changes as a design…</button>}
            <button onClick={() => void saveDesignFile(current ?? { id: DEFAULT_DESIGN_ID, name, panels: state.shared.panels, spine: state.shared.spine, ...(state.shared.diff && { diff: state.shared.diff }) }, state.assets)}>Export “{name}” as a file…</button>
            <button disabled={!item} onClick={() => importInput.current?.click()}>Import a design file…</button>
            {!isDefault && <button onClick={() => setNaming('rename')}>Rename “{name}”</button>}
            <button onClick={() => dispatch({ type: 'clearDesign', design: designId, panel })}>{panel === 'canvas' ? `Reset the layers across panels in “${name}”` : `Reset this panel in “${name}”`}</button>
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
          title="New design"
          initial={isDefault ? `Design ${designs.length + 2}` : `${name} copy`}
          confirm="Create"
          onClose={() => setNaming(null)}
          onDone={(n) => dispatch({ type: 'forkDesign', id: `design-${Date.now().toString(36)}`, name: n, from: designId, items: [item.id] })}
        />
      )}
      {naming === 'save' && item && (
        <NameModal title="Save as a design" initial={`${item.title} look`} confirm="Save" onClose={() => setNaming(null)} onDone={(n) => dispatch({ type: 'saveItemAsDesign', itemId: item.id, id: `design-${Date.now().toString(36)}`, name: n })} />
      )}
      {presets && <PresetModal onClose={() => setPresets(false)} />}
      {fileError && <p className="error small">{fileError}</p>}
      <input
        ref={importInput}
        type="file"
        accept=".json,application/json"
        hidden
        aria-label="Choose a design file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file || !item) return;
          setFileError(null);
          readDesignFile(file, state.assets).then(
            ({ design, assets }) => {
              for (const a of Object.values(assets)) dispatch({ type: 'setAsset', asset: a });
              dispatch({ type: 'addDesign', design, items: [item.id] });
            },
            (err: unknown) => setFileError(err instanceof Error ? err.message : 'That file couldn’t be read.'),
          );
        }}
      />
      {naming === 'rename' && <NameModal title="Rename design" initial={name} confirm="Rename" onClose={() => setNaming(null)} onDone={(n) => dispatch({ type: 'renameDesign', id: designId, name: n })} />}
    </>
  );
}
