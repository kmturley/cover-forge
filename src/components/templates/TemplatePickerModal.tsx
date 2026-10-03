import { useState } from 'react';
import { templateIdOf, useAppDispatch, useAppState } from '../../context/AppContext';
import { groupFor, originalTemplateFor } from '../../templates/library';
import type { MediaType } from '../../types/media';
import { TemplateLibrary } from './TemplateLibrary';

const PLURAL: Record<MediaType, string> = { game: 'games', movie: 'movies', tv: 'TV shows', music: 'music', custom: 'custom items' };

type Scope = 'item' | 'group' | 'type' | 'all';

/**
 * Picks the case for some items: one (then also offering every item of its type, or the whole queue) or a group of
 * them (a queue group, offering the whole queue too).
 */
export function TemplatePickerModal({ itemIds, onClose }: { itemIds: string[]; onClose: () => void }) {
  const state = useAppState();
  const { items } = state;
  const chosen = items.filter((i) => itemIds.includes(i.id));
  const item = chosen[0];
  const dispatch = useAppDispatch();
  const [scope, setScope] = useState<Scope>(chosen.length > 1 ? 'group' : 'item');
  if (!item) return null;

  const single = chosen.length === 1;
  const sameType = items.filter((i) => i.type === item.type);
  const scopes: { id: Scope; label: string; ids: string[] }[] = [
    single ? { id: 'item', label: 'This item', ids: [item.id] } : { id: 'group', label: `These ${chosen.length} items`, ids: chosen.map((i) => i.id) },
    ...(single && sameType.length > 1 && sameType.length < items.length ? [{ id: 'type' as const, label: `All ${PLURAL[item.type]} (${sameType.length})`, ids: sameType.map((i) => i.id) }] : []),
    ...(items.length > chosen.length ? [{ id: 'all' as const, label: `Whole queue (${items.length})`, ids: items.map((i) => i.id) }] : []),
  ];
  const current = [...new Set(chosen.map((i) => templateIdOf(state, i)))];
  // The scope was picked from an earlier render's options; if the items changed since, fall back to the first.
  const targets = (scopes.find((s) => s.id === scope) ?? scopes[0]).ids;
  // When every item is the same kind of media: its group comes first, marked recommended, with its original case marked.
  const type = chosen.every((i) => i.type === item.type) ? item.type : null;
  const recommended = type ? groupFor(type) : null;
  const original = type ? originalTemplateFor(type) : null;

  function pick(id: string) {
    dispatch({ type: 'setItemTemplate', items: targets, template: id });
    onClose();
  }

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="picker-title" onClick={onClose}>
      <div className="modal wide" onClick={(e) => e.stopPropagation()}>
        <h2 id="picker-title" className="modal-title">{single ? `Case for “${item.title}”` : `Case for ${chosen.length} items`}</h2>
        {scopes.length > 1 && (
          <div className="seg picker-scope" role="group" aria-label="Apply to">
            {scopes.map((s) => (
              <button key={s.id} className={s.id === scope ? 'active' : ''} aria-pressed={s.id === scope} onClick={() => setScope(s.id)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        <TemplateLibrary selected={current.length === 1 ? current : []} onPick={pick} recommended={recommended} original={original} />
        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
