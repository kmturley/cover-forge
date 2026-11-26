import type { SizedEntry } from '../../templates/compare';
import type { MediaItem } from '../../types/media';
import { TemplateIcon } from './TemplateIcon';
import { Thumbnail, useThumbnails } from './useThumbnails';

interface Props {
  /** What to show, already searched, sorted and grouped by the picker. A group with no name is shown without a heading. */
  groups: { name: string; entries: SizedEntry[] }[];
  /** Every template, so the thumbnails are drawn once and kept while the list is searched or regrouped. */
  all: SizedEntry[];
  /** The item whose design the thumbnails show. */
  item: MediaItem | null;
  /** Ids shown as picked. */
  selected: string[];
  onPick: (id: string) => void;
  /** The group made for the items' media, marked "(recommended)". */
  recommended?: string | null;
  /** The template the items' original release came in, marked so it's easy to go back to. */
  original?: string | null;
  /** Shown when nothing matches. */
  empty: string;
}

/** The templates as a grid of tiles, in the groups and order the picker gives, each with the item's front on it. */
export function TemplateLibrary({ groups, all, item, selected, onPick, recommended = null, original = null, empty }: Props) {
  const thumbs = useThumbnails(all, item);
  return (
    <div className="library-list">
      {!groups.length && <p className="muted">{empty}</p>}
      {groups.map((group) => (
        <section key={group.name || 'all'} aria-label={group.name || 'Templates'}>
          {group.name && (
            <h3 className="library-group">
              {group.name}
              {group.name === recommended && <span className="recommended"> (recommended)</span>}
            </h3>
          )}
          <div className="library-grid">
            {group.entries.map(({ entry: e }) => {
              const on = selected.includes(e.id);
              const isOriginal = e.id === original;
              return (
                <button
                  key={e.id}
                  className={`library-tile ${on ? 'selected' : ''} ${isOriginal ? 'original' : ''}`}
                  role="radio"
                  aria-checked={on}
                  title={isOriginal ? 'The case this was originally released in' : undefined}
                  onClick={() => onPick(e.id)}
                >
                  <span className="library-thumb">{thumbs.has(e.id) ? <Thumbnail canvas={thumbs.get(e.id)!} /> : <TemplateIcon kind={e.kind} />}</span>
                  <span className="library-text">
                    <span className="library-name">
                      {e.name}
                      {isOriginal && (
                        <span className="original-badge" aria-label="(original)">
                          <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" fill="currentColor">
                            <path d="M8 1.2l2 4.3 4.7.5-3.5 3.2 1 4.6L8 11.5 3.8 13.8l1-4.6L1.3 6l4.7-.5z" />
                          </svg>
                          Original
                        </span>
                      )}
                    </span>
                    <small>{e.detail}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
