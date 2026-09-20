import { useAppDispatch, useAppState } from '../../context/AppContext';
import { itemHasOverrides } from '../../engine/resolve';
import { srcOf } from '../../storage/localImages';

function OverrideIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <path d="M2 4h7M13 4h1M2 12h1M7 12h7" />
      <circle cx="11" cy="4" r="2" />
      <circle cx="5" cy="12" r="2" />
    </svg>
  );
}

export function QueueList() {
  const { items, selectedItemId } = useAppState();
  const dispatch = useAppDispatch();

  function resetOverrides(id: string, title: string) {
    if (window.confirm(`Remove all overrides for “${title}” and use the shared settings?`)) {
      dispatch({ type: 'clearOverrides', id });
    }
  }

  return (
    <section className="queue">
      <h2>Queue ({items.length})</h2>
      {!items.length && <p className="muted">Search for a game and click it to add it here.</p>}
      <ul>
        {items.map((item, i) => (
          <li key={item.id} className={item.id === selectedItemId ? 'selected' : ''}>
            <button className="item" onClick={() => dispatch({ type: 'selectItem', id: item.id })}>
              {item.assets.cover && <img src={srcOf(item.assets.cover)} alt="" loading="lazy" crossOrigin="anonymous" />}
              <span>
                {item.title}
                {item.year && <small> · {item.year}</small>}
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
              <button aria-label={`Move ${item.title} up`} disabled={i === 0} onClick={() => dispatch({ type: 'reorderItems', from: i, to: i - 1 })}>
                ↑
              </button>
              <button aria-label={`Move ${item.title} down`} disabled={i === items.length - 1} onClick={() => dispatch({ type: 'reorderItems', from: i, to: i + 1 })}>
                ↓
              </button>
              <button aria-label={`Remove ${item.title}`} onClick={() => dispatch({ type: 'removeItem', id: item.id })}>
                ✕
              </button>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
