import type { SteamSearchResult } from '../../api/steam';

interface Props {
  results: SteamSearchResult[];
  addingId: number | null;
  onAdd: (r: SteamSearchResult) => void;
}

export function SearchResults({ results, addingId, onAdd }: Props) {
  if (!results.length) return null;
  return (
    <ul className="results">
      {results.map((r) => (
        <li key={r.appId}>
          <button onClick={() => onAdd(r)} disabled={addingId === r.appId} title="Add to queue">
            {r.thumbnail && <img src={r.thumbnail} alt="" loading="lazy" />}
            <span>{r.name}</span>
            <span className="add">{addingId === r.appId ? '…' : '+'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
