import { templateIdOf, useAppDispatch, useAppState } from '../../context/AppContext';
import { LIBRARY_ORDER, getEntry } from '../../templates/library';
import { useMemo, useState } from 'react';
import { TemplatePickerModal } from '../templates/TemplatePickerModal';
import { itemHasOverrides } from '../../engine/resolve';
import { srcOf } from '../../storage/localImages';
import type { MediaItem } from '../../types/media';

function OverrideIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M2 4h7M13 4h1M2 12h1M7 12h7" />
      <circle cx="11" cy="4" r="2" />
      <circle cx="5" cy="12" r="2" />
    </svg>
  );
}

/** Every queued item, grouped by case (the order export lays out print sheets in), alphabetical within a group. */
export function QueueList() {
  const { items, selectedItemId, designs, templateId } = useAppState();
  const dispatch = useAppDispatch();
  const [picking, setPicking] = useState<string[] | null>(null);
  const groups = useMemo(() => {
    const byCase = new Map<string, MediaItem[]>();
    for (const i of items) {
      const id = templateIdOf({ templateId }, i);
      const members = byCase.get(id);
      if (members) members.push(i);
      else byCase.set(id, [i]);
    }
    // Like the library: games first, then films and TV, music, and the rest.
    const order = (id: string) => LIBRARY_ORDER.get(id) ?? Number.MAX_SAFE_INTEGER;
    return [...byCase.entries()].sort(([a], [b]) => order(a) - order(b)).map(([id, members]) => ({ entry: getEntry(id), members }));
  }, [items, templateId]);

  function resetOverrides(id: string, title: string) {
    if (window.confirm(`Remove all overrides for “${title}” and use the shared settings?`)) {
      dispatch({ type: 'clearOverrides', id });
    }
  }

  return (
    <section className="queue">
      {!items.length && <p className="muted">Search above and click a result to add it here.</p>}
      {groups.map(({ entry, members }) => (
        <div key={entry?.id} className="queue-group">
          <div className="queue-group-head">
            <span>
              {entry?.name} <small>· {members.length}</small>
            </span>
            <button title={`Change the case for these ${members.length === 1 ? 'item' : `${members.length} items`}`} onClick={() => setPicking(members.map((m) => m.id))}>
              Change…
            </button>
          </div>
          <ul>
            {members.map((item) => (
              <li key={item.id} className={item.id === selectedItemId ? 'selected' : ''}>
                <button className="item" onClick={() => dispatch({ type: 'selectItem', id: item.id })}>
                  {item.assets.cover && <img src={srcOf(item.assets.cover)} alt="" loading="lazy" crossOrigin="anonymous" />}
                  <span>
                    {item.title}
                    {item.year && <small> · {item.year}</small>}
                    {item.designId && designs.some((d) => d.id === item.designId) && <small className="design-tag">{designs.find((d) => d.id === item.designId)!.name}</small>}
                  </span>
                </button>
                <span className="row-actions">
                  {itemHasOverrides(item) && (
                    <button
                      className="override-badge"
                      title="This item overrides the shared settings. Click to remove its overrides."
                      aria-label={`Remove overrides for ${item.title}`}
                      onClick={() => resetOverrides(item.id, item.title)}
                    >
                      <OverrideIcon />
                    </button>
                  )}
                  <button aria-label={`Remove ${item.title}`} onClick={() => dispatch({ type: 'removeItem', id: item.id })}>
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {picking && <TemplatePickerModal itemIds={picking} onClose={() => setPicking(null)} />}
    </section>
  );
}
