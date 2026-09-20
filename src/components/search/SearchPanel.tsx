import { useEffect, useState } from 'react';
import { PROVIDERS, getProvider, type ProviderId, type SearchResult } from '../../api/providers';
import { useAppDispatch } from '../../context/AppContext';
import { CustomEntry } from './CustomEntry';
import { SearchResults } from './SearchResults';
import { QueueList } from './QueueList';

type Tab = ProviderId | 'custom';

export function SearchPanel() {
  const dispatch = useAppDispatch();
  const [tab, setTab] = useState<Tab>('steam');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  const provider = tab === 'custom' ? null : getProvider(tab);
  const searchable = provider?.available && query.trim().length > 0;

  useEffect(() => {
    if (!provider || !provider.available || !query.trim()) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await provider.search(query, ctrl.signal));
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
  }, [provider, query]);

  function switchTab(next: Tab) {
    setTab(next);
    setResults([]);
    setError(null);
  }

  async function add(r: SearchResult) {
    if (!provider) return;
    setAdding(r.id);
    setError(null);
    try {
      dispatch({ type: 'addItem', item: await provider.createItem(r) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Couldn’t add that item');
    } finally {
      setAdding(null);
    }
  }

  return (
    <aside className="sidebar left">
      <h2>Add media</h2>
      <div className="provider-tabs" role="tablist" aria-label="Media source">
        {PROVIDERS.map((p) => (
          <button key={p.id} role="tab" aria-selected={tab === p.id} className={tab === p.id ? 'active' : ''} onClick={() => switchTab(p.id)} title={p.available ? undefined : p.unavailableReason}>
            {p.label}
          </button>
        ))}
        <button role="tab" aria-selected={tab === 'custom'} className={tab === 'custom' ? 'active' : ''} onClick={() => switchTab('custom')}>
          Custom
        </button>
      </div>

      {tab === 'custom' ? (
        <CustomEntry />
      ) : provider && !provider.available ? (
        <p className="muted">{provider.unavailableReason}</p>
      ) : (
        <>
          <div className="search-input">
            <input type="search" value={query} placeholder={provider!.placeholder} onChange={(e) => setQuery(e.target.value)} aria-label={`Search ${provider!.label}`} />
            {loading && <span className="spinner" role="status" aria-label="Loading" />}
          </div>
          {error && <p className="error">{error}</p>}
          <SearchResults results={searchable ? results : []} addingId={adding} onAdd={add} />
        </>
      )}
      <QueueList />
    </aside>
  );
}
