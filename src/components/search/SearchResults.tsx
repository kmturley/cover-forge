import { useState } from 'react';
import type { SearchResult } from '../../api/providers';

interface Props {
  results: SearchResult[];
  addingId: string | null;
  onAdd: (r: SearchResult) => void;
}

/** A result's thumbnail; hidden if it fails to load (e.g. an album with no cover art). */
function Thumb({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <span className="result-thumb empty" aria-hidden="true" />;
  return <img className="result-thumb" src={src} alt="" loading="lazy" onError={() => setFailed(true)} />;
}

export function SearchResults({ results, addingId, onAdd }: Props) {
  if (!results.length) return null;
  return (
    <ul className="results">
      {results.map((r) => (
        <li key={r.id}>
          <button onClick={() => onAdd(r)} disabled={addingId === r.id} title="Add to queue">
            <Thumb src={r.thumbnail} />
            <span className="result-text">
              <span className="result-title">{r.title}</span>
              {(r.subtitle || r.year) && <small>{[r.subtitle, r.year].filter(Boolean).join(' · ')}</small>}
            </span>
            <span className="add">{addingId === r.id ? '…' : '+'}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
