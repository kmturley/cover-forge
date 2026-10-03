import { useState } from 'react';
import { LIBRARY_GROUPS, searchLibrary, type LibraryGroup } from '../../templates/library';
import { TemplateIcon } from './TemplateIcon';

interface Props {
  /** Ids shown as picked. */
  selected: string[];
  onPick: (id: string) => void;
  /** The group made for the items' media, listed first and marked "(recommended)". */
  recommended?: LibraryGroup | null;
  /** The case the items' original release came in, marked so it's easy to go back to. */
  original?: string | null;
}

/** Every template as a searchable grid, grouped by what it's for, by name within a group. */
export function TemplateLibrary({ selected, onPick, recommended = null, original = null }: Props) {
  const [query, setQuery] = useState('');
  const found = searchLibrary(query);
  const groups = recommended ? [recommended, ...LIBRARY_GROUPS.filter((g) => g !== recommended)] : [...LIBRARY_GROUPS];
  return (
    <div className="library">
      <div className="library-search">
        <input type="search" autoFocus placeholder="Search cases: PS4, Blu-ray, vinyl, Nintendo…" aria-label="Search templates" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <div className="library-list">
        {!found.length && <p className="muted">No templates match “{query}”.</p>}
        {groups.map((group) => {
          const shown = found.filter((e) => e.group === group);
          if (!shown.length) return null;
          return (
            <section key={group} aria-label={group}>
              <h3 className="library-group">
                {group}
                {group === recommended && <span className="recommended"> (recommended)</span>}
              </h3>
              <div className="library-grid">
                {shown.map((e) => {
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
                      <TemplateIcon kind={e.kind} />
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
          );
        })}
      </div>
    </div>
  );
}
