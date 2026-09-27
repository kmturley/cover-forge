import { useEffect, useMemo, useRef, useState } from 'react';
import { getProviders, type ProviderId, type SearchResult } from '../../api/providers';
import { useAppDispatch } from '../../context/AppContext';
import { CustomEntry } from './CustomEntry';
import { MovieKeySetup } from './MovieKeySetup';
import { SearchResults } from './SearchResults';
import { QueueList } from './QueueList';

/** Which results the dropdown shows: a few from every catalogue, or all of one. */
type Filter = ProviderId | 'all';
type TaggedResult = SearchResult & { providerId: ProviderId };

/** Results shown per catalogue under "All"; its own tab shows the rest. */
const ALL_RESULTS_PER_PROVIDER = 5;

/**
 * One search across every catalogue. The results open under it with tabs that only filter them (All, Games, Movies…);
 * the queue below always lists everything. Anything the catalogues don't have is added by hand ("Add your own").
 */
export function SearchPanel() {
  const dispatch = useAppDispatch();
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Partial<Record<ProviderId, TaggedResult[]>>>({});
  // Catalogues whose last search failed (offline, blocked, rate limited): said so under their tab rather than shown as empty.
  const [failed, setFailed] = useState<ProviderId[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [custom, setCustom] = useState(false);
  // Whether the results float over the media list; closed by clearing the search or clicking elsewhere.
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  // Bumped after a personal API key is saved, so providers (whose `available` flag can depend on one) are re-read.
  const [keyVersion, setKeyVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyVersion is the trigger to re-read providers (their `available` flag can depend on a key just saved to localStorage)
  const providers = useMemo(() => getProviders(), [keyVersion]);

  // Every available catalogue at once; each one failing on its own shows as no results rather than blanking the rest.
  useEffect(() => {
    const term = query.trim();
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (!term) {
        setResults({});
        setFailed([]);
        return;
      }
      setLoading(true);
      setError(null);
      const available = providers.filter((p) => p.available);
      const found = await Promise.all(
        available.map(async (p) => {
          try {
            return [p.id, (await p.search(term, ctrl.signal)).map((r) => ({ ...r, providerId: p.id }))] as const;
          } catch {
            return [p.id, null] as const;
          }
        }),
      );
      if (ctrl.signal.aborted) return;
      setResults(Object.fromEntries(found.map(([id, list]) => [id, list ?? []])));
      setFailed(found.filter(([, list]) => !list).map(([id]) => id));
      setLoading(false);
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [providers, query]);

  // …or when clicking anywhere outside it, revealing the media list it was floating over.
  useEffect(() => {
    if (!dropdownOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (searchAreaRef.current && !searchAreaRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [dropdownOpen]);

  async function add(r: TaggedResult) {
    const source = providers.find((p) => p.id === r.providerId);
    if (!source) return;
    setAdding(r.id);
    setError(null);
    try {
      dispatch({ type: 'addItem', item: await source.createItem(r) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that item');
    } finally {
      setAdding(null);
    }
  }

  const count = (id: ProviderId) => results[id]?.length ?? 0;
  const total = providers.reduce((n, p) => n + count(p.id), 0);
  const shown = filter === 'all' ? providers.filter((p) => count(p.id) > 0) : providers.filter((p) => p.id === filter);
  const active = providers.find((p) => p.id === filter);

  return (
    <>
      <h2>Media</h2>
      <div className="search-area" ref={searchAreaRef}>
        <div className="search-input">
          <input
            type="search"
            value={query}
            placeholder="Search games, films, TV and music…"
            onChange={(e) => {
              setQuery(e.target.value);
              setDropdownOpen(!!e.target.value.trim());
            }}
            onFocus={() => query.trim() && setDropdownOpen(true)}
            aria-label="Search media"
          />
          {loading && <span className="spinner" role="status" aria-label="Loading" />}
        </div>
        {dropdownOpen && (
          <div className="search-dropdown">
            <div className="provider-tabs" role="tablist" aria-label="Show results from">
              <button role="tab" aria-selected={filter === 'all'} className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
                All{!loading && ` ${total}`}
              </button>
              {providers.map((p) => (
                <button key={p.id} role="tab" aria-selected={filter === p.id} className={filter === p.id ? 'active' : ''} onClick={() => setFilter(p.id)} title={p.available ? undefined : p.unavailableReason}>
                  {p.label}
                  {!p.available || failed.includes(p.id) ? ' ·' : !loading && ` ${count(p.id)}`}
                </button>
              ))}
            </div>
            {error && <p className="error">{error}</p>}
            {active?.id === 'movies' && <MovieKeySetup onSaved={() => setKeyVersion((v) => v + 1)} required={!active.available} />}
            {active && !active.available && active.id !== 'movies' && <p className="muted">{active.unavailableReason}</p>}
            {!loading && failed.filter((id) => filter === 'all' || id === filter).map((id) => (
              <p key={id} className="muted small">Couldn’t search {providers.find((p) => p.id === id)?.label.toLowerCase()} just now.</p>
            ))}
            {shown.map((p) => {
              const list = results[p.id] ?? [];
              const cut = filter === 'all' ? list.slice(0, ALL_RESULTS_PER_PROVIDER) : list;
              return (
                <div key={p.id} className="result-group">
                  {filter === 'all' && <h3 className="result-group-label">{p.label}</h3>}
                  <SearchResults results={cut} addingId={adding} onAdd={add} />
                  {cut.length < list.length && (
                    <button className="link-button" onClick={() => setFilter(p.id)}>
                      All {list.length} {p.label.toLowerCase()} →
                    </button>
                  )}
                </div>
              );
            })}
            {!loading && (active ? active.available && !failed.includes(active.id) && !count(active.id) : !total && !failed.length) && <p className="muted small">No results.</p>}
          </div>
        )}
      </div>
      <button className="link-button add-own" aria-expanded={custom} onClick={() => setCustom((c) => !c)}>
        {custom ? 'Close' : 'Not found? Add your own…'}
      </button>

      <div className="pane-scroll">
        {custom && <CustomEntry />}
        <QueueList />
      </div>
    </>
  );
}
