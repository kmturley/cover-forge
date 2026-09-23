import { useState } from 'react';
import { getOmdbKey, setOmdbKey } from '../../api/providers/omdbKey';
import { getTmdbKey, setTmdbKey } from '../../api/providers/tmdbKey';

type Kind = 'tmdb' | 'omdb';

const COPY: Record<Kind, { label: string; href: string; linkText: string; placeholder: string; get: () => string | null; set: (v: string) => void }> = {
  tmdb: {
    label: 'TMDB API Read Access Token',
    href: 'https://www.themoviedb.org/settings/api',
    linkText: 'Get a free TMDB key',
    placeholder: 'Your TMDB API Read Access Token',
    get: getTmdbKey,
    set: setTmdbKey,
  },
  omdb: {
    label: 'OMDb API key',
    href: 'https://www.omdbapi.com/apikey.aspx',
    linkText: 'Get a free OMDb key',
    placeholder: 'Your OMDb API key',
    get: getOmdbKey,
    set: setOmdbKey,
  },
};

/**
 * Movies need a key somewhere (there's no free, key-less movie catalogue). TMDB gives richer art (separate poster,
 * backdrop and logo) than OMDb's single poster, so it's offered first; either is instant, free and kept only in this
 * browser (`localStorage`), never sent anywhere but the chosen provider. `onCancel` is only passed when this is an
 * optional add-on (a shared key already works) rather than the only way to turn Movies on.
 */
export function MovieKeySetup({ onSaved, onCancel }: { onSaved: () => void; onCancel?: () => void }) {
  const [kind, setKind] = useState<Kind>('tmdb');
  const c = COPY[kind];
  const [value, setValue] = useState(c.get() ?? '');

  function switchKind(next: Kind) {
    setKind(next);
    setValue(COPY[next].get() ?? '');
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    c.set(value);
    onSaved();
  }

  return (
    <form className="omdb-setup" onSubmit={save}>
      <p className="muted">
        {onCancel ? 'Your own key searches under your own quota instead of the shared one.' : 'Movie search needs a free API key.'}{' '}
        <a href={c.href} target="_blank" rel="noreferrer">
          {c.linkText}
        </a>
        , then paste it below.
      </p>
      <div className="field row">
        <input type="text" value={value} onChange={(e) => setValue(e.target.value)} placeholder={c.placeholder} aria-label={c.label} />
        <button type="submit" className="primary" disabled={!value.trim()}>
          Save
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      <p className="muted small">
        {kind === 'tmdb' ? (
          <>
            Prefer OMDb?{' '}
            <button className="link" type="button" onClick={() => switchKind('omdb')}>
              Use an OMDb key instead
            </button>
          </>
        ) : (
          <>
            Want TMDB's richer art (separate poster, backdrop and logo)?{' '}
            <button className="link" type="button" onClick={() => switchKind('tmdb')}>
              Use a TMDB key instead
            </button>
          </>
        )}
      </p>
    </form>
  );
}
