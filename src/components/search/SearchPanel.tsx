import { useEffect, useMemo, useRef, useState } from 'react';
import { getProviders, type ProviderId, type SearchResult } from '../../api/providers';
import { useAppDispatch } from '../../context/AppContext';
import { CustomEntry } from './CustomEntry';
import { MovieKeySetup } from './MovieKeySetup';
import { SearchResults } from './SearchResults';
import type { MediaType } from '../../types/media';
import { QueueList } from './QueueList';

type Tab = ProviderId | 'custom' | 'all';
type TaggedResult = SearchResult & { providerId: ProviderId; providerLabel?: string };

/** Results kept from each catalogue when the "All" tab searches every one of them at once. */
const ALL_TAB_RESULTS_PER_PROVIDER = 5;

export function SearchPanel() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>('all');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TaggedResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  // Whether the results float over the media list; closed by clearing the search or clicking elsewhere.
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchAreaRef = useRef<HTMLDivElement>(null);
  // Bumped after a personal API key is saved, so providers (whose `available` flag can depend on one) are re-read.
  const [keyVersion, setKeyVersion] = useState(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- keyVersion is the trigger to re-read providers (their `available` flag can depend on a key just saved to localStorage)
  const providers = useMemo(() => getProviders(), [keyVersion]);

  const provider = tab === 'custom' || tab === 'all' ? null : providers.find((p) => p.id === tab);
  const filter: MediaType | 'all' = tab === 'all' ? 'all' : tab === 'custom' ? 'custom' : (provider?.mediaType ?? 'all');
  const canSearch = tab === 'all' ? providers.some((p) => p.available) : !!provider?.available;

  // Search either one provider (a specific tab) or every available one at once ("All"): first N results from each.
  useEffect(() => {
    const term = query.trim();
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      if (!term || !canSearch) {
        setResults([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        if (tab === 'all') {
          const available = providers.filter((p) => p.available);
          const perProvider = await Promise.all(
            available.map(async (p) => {
              try {
                const found = await p.search(term, ctrl.signal);
                return found.slice(0, ALL_TAB_RESULTS_PER_PROVIDER).map((r) => ({ ...r, providerId: p.id, providerLabel: p.label }));
              } catch {
                return []; // one catalogue failing shouldn't blank out the others
              }
            }),
          );
          if (!ctrl.signal.aborted) setResults(perProvider.flat());
        } else if (provider) {
          const found = await provider.search(term, ctrl.signal);
          if (!ctrl.signal.aborted) setResults(found.map((r) => ({ ...r, providerId: provider.id })));
        }
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [tab, provider, providers, query, canSearch]);

  // …or when clicking anywhere outside it, revealing the media list it was floating over.
  useEffect(() => {
    if (!dropdownOpen) return;
    function onPointerDown(e: MouseEvent) {
      if (searchAreaRef.current && !searchAreaRef.current.contains(e.target as Node)) setDropdownOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [dropdownOpen]);

  function switchTab(next: Tab) {
    setTab(next);
    setResults([]);
    setError(null);
    setDropdownOpen(false);
  }

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

  const placeholder = tab === 'all' ? 'Search all media types…' : (provider?.placeholder ?? 'Search…');

  // On the All tab, split the mixed results into a labelled group per catalogue (in provider order); a specific
  // tab's results are just one unlabelled group, rendered the same way.
  const resultGroups = useMemo(() => {
    if (tab !== 'all') return [{ label: null as string | null, items: results }];
    const byLabel = new Map<string, TaggedResult[]>();
    for (const r of results) {
      const label = r.providerLabel ?? '';
      if (!byLabel.has(label)) byLabel.set(label, []);
      byLabel.get(label)!.push(r);
    }
    return [...byLabel.entries()].map(([label, items]) => ({ label, items }));
  }, [tab, results]);

  return (
    <>
      <h2>Media</h2>
      <div className="provider-tabs" role="tablist" aria-label="Media type">
        <button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'active' : ''} onClick={() => switchTab('all')}>
          All
        </button>
        {providers.map((p) => (
          <button key={p.id} role="tab" aria-selected={tab === p.id} className={tab === p.id ? 'active' : ''} onClick={() => switchTab(p.id)} title={p.available ? undefined : p.unavailableReason}>
            {p.label}
          </button>
        ))}
        <button role="tab" aria-selected={tab === 'custom'} className={tab === 'custom' ? 'active' : ''} onClick={() => switchTab('custom')}>
          Custom
        </button>
      </div>

      {canSearch && (
        <div className="search-area" ref={searchAreaRef}>
          <div className="search-input">
            <input
              type="search"
              value={query}
              placeholder={placeholder}
              onChange={(e) => {
                setQuery(e.target.value);
                setDropdownOpen(!!e.target.value.trim());
              }}
              onFocus={() => query.trim() && setDropdownOpen(true)}
              aria-label={tab === 'all' ? 'Search all media types' : `Search ${provider?.label}`}
            />
            {loading && <span className="spinner" role="status" aria-label="Loading" />}
          </div>
          {dropdownOpen && (
            <div className="search-dropdown">
              {error && <p className="error">{error}</p>}
              {!error &&
                resultGroups.map((g) => (
                  <div key={g.label ?? ''} className={g.label ? 'result-group' : undefined}>
                    {g.label && <h3 className="result-group-label">{g.label}</h3>}
                    <SearchResults results={g.items} addingId={adding} onAdd={add} />
                  </div>
                ))}
              {!loading && !error && !results.length && <p className="muted small">No results.</p>}
            </div>
          )}
        </div>
      )}

      {tab === 'movies' && <MovieKeySetup onSaved={() => setKeyVersion((v) => v + 1)} required={!provider?.available} />}

      <div className="pane-scroll">
        {tab === 'custom' ? <CustomEntry /> : provider && !provider.available && tab !== 'movies' ? <p className="muted">{provider.unavailableReason}</p> : null}
        <QueueList filter={filter} />
      </div>
    </>
  );
}
