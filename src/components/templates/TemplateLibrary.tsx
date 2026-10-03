import { useState } from 'react';
import { LIBRARY_GROUPS, searchLibrary, type LibraryGroup } from '../../templates/library';
import { TemplateIcon } from './TemplateIcon';

interface Props {
  /** Ids shown as picked. */
  selected: string[];
  onPick: (id: string) => void;
  /** Groups to list first (e.g. the ones that suit the item). */
  first?: LibraryGroup[];
}

/** Every template as a searchable grid, grouped by what it's for. */
export function TemplateLibrary({ selected, onPick, first = [] }: Props) {
  const [query, setQuery] = useState('');
  const found = searchLibrary(query);
  const groups = [...first, ...LIBRARY_GROUPS.filter((g) => !first.includes(g))];
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
              <h3 className="library-group">{group}</h3>
              <div className="library-grid">
                {shown.map((e) => {
                  const on = selected.includes(e.id);
                  return (
                    <button key={e.id} className={`library-tile ${on ? 'selected' : ''}`} role="radio" aria-checked={on} onClick={() => onPick(e.id)}>
                      <TemplateIcon kind={e.kind} />
                      <span className="library-text">
                        <span className="library-name">{e.name}</span>
                        <small>{e.size}</small>
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
