import { useState } from 'react';
import { getOmdbKey, setOmdbKey } from '../../api/providers/omdbKey';
import { getTmdbKey, setTmdbKey } from '../../api/providers/tmdbKey';
import { usingSharedMovieKey } from '../../api/providers/movies';
import { Section } from '../editor/Section';

/**
 * Movies need a key somewhere (there's no free, key-less movie catalogue): a TMDB "API Read Access Token" (richer
 * art: separate poster, backdrop and logo) or an OMDb "API key" (one poster only). Either is instant, free and kept
 * only in this browser (localStorage), never sent anywhere but the chosen provider's API.
 *
 * TMDB actually issues two different credentials (a v3 "API key" and a v4 "API Read Access Token") — this app uses
 * the Read Access Token, so that's the exact term shown here to avoid pasting the wrong one.
 */
function summaryText(): string | null {
  if (getTmdbKey() || getOmdbKey()) return null;
  if (usingSharedMovieKey()) return 'Using a shared key (its daily quota is split across every visitor).';
  return 'Not configured.';
}

function KeyForm({ onDone }: { onDone: () => void }) {
  const [tmdb, setTmdb] = useState(getTmdbKey() ?? '');
  const [omdb, setOmdb] = useState(getOmdbKey() ?? '');

  function save(e: React.FormEvent) {
    e.preventDefault();
    setTmdbKey(tmdb);
    setOmdbKey(omdb);
    onDone();
  }

  return (
    <form className="movie-key-setup" onSubmit={save}>
      <p className="muted">To enable Movie search enter either:</p>
      <div className="movie-key-fields">
        <label className="field">
          <span>
            TMDB API Read Access Token (
            <a href="https://www.themoviedb.org/settings/api" target="_blank" rel="noreferrer">
              Get one free
            </a>
            )
          </span>
          <input type="text" value={tmdb} onChange={(e) => setTmdb(e.target.value)} placeholder="Paste your token" aria-label="TMDB API Read Access Token" />
        </label>
        <label className="field">
          <span>
            OMDb API key (
            <a href="https://www.omdbapi.com/apikey.aspx" target="_blank" rel="noreferrer">
              Get one free
            </a>
            )
          </span>
          <input type="text" value={omdb} onChange={(e) => setOmdb(e.target.value)} placeholder="Paste your key" aria-label="OMDb API key" />
        </label>
      </div>
      <button type="submit" className="primary" disabled={!tmdb.trim() && !omdb.trim()}>
        Save
      </button>
    </form>
  );
}

export function MovieKeySetup({ onSaved, required = false }: { onSaved: () => void; required?: boolean }) {
  const [editing, setEditing] = useState(required);

  function done() {
    setEditing(false);
    onSaved();
  }

  if (required) return <KeyForm onDone={done} />;

  const summary = summaryText();
  return (
    <Section title="Settings" summary={summary && <p className="muted small">{summary}</p>} editing={editing} onEdit={() => setEditing(true)} onDone={() => setEditing(false)}>
      <KeyForm onDone={done} />
    </Section>
  );
}
