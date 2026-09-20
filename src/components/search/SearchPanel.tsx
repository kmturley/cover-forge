import { useEffect, useState } from 'react';
import { createGameItem, searchGames, type SteamSearchResult } from '../../api/steam';
import { useAppDispatch } from '../../context/AppContext';
import { SearchResults } from './SearchResults';
import { QueueList } from './QueueList';

export function SearchPanel() {
  const dispatch = useAppDispatch();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SteamSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState<number | null>(null);

  useEffect(() => {
    if (!query.trim()) return;
    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setResults(await searchGames(query, ctrl.signal));
      } catch (e) {
        if (!ctrl.signal.aborted) setError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  async function add(r: SteamSearchResult) {
    setAdding(r.appId);
    try {
      dispatch({ type: 'addItem', item: await createGameItem(r) });
    } finally {
      setAdding(null);
    }
  }

  return (
    <aside className="sidebar left">
      <h2>Search games</h2>
      <div className="search-input">
        <input
          type="search"
          value={query}
          placeholder="Search Steam…"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search games"
        />
        {loading && <span className="spinner" role="status" aria-label="Loading" />}
      </div>
      {error && query.trim() && <p className="error">{error}</p>}
      <SearchResults results={query.trim() ? results : []} addingId={adding} onAdd={add} />
      <QueueList />
    </aside>
  );
}
