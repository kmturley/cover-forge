import type { MediaItem } from '../../types/media';
import { fetchJson } from '../http';
import type { Provider, SearchResult } from './types';

/**
 * TMDB is the best movie catalogue, but it only answers requests carrying an API key. To keep visitors key-free the key
 * lives in a relay you deploy (see worker/steam-proxy.js, secret TMDB_TOKEN) and this provider only switches on when
 * VITE_TMDB_PROXY_URL points at it. Without it the Movies tab explains what's missing.
 */
const RELAY = import.meta.env.VITE_TMDB_PROXY_URL as string | undefined;
const API = 'https://api.themoviedb.org/3';
const IMG = 'https://image.tmdb.org/t/p';

const through = (relay: string, path: string) => (relay.endsWith('/') ? `${relay}${API}${path}` : `${relay}?url=${encodeURIComponent(`${API}${path}`)}`);

interface TmdbSearch {
  results?: { id: number; title: string; release_date?: string; poster_path?: string | null; original_title?: string }[];
}
interface TmdbFile {
  file_path: string;
  iso_639_1?: string | null;
  vote_average?: number;
}
interface TmdbImages {
  posters?: TmdbFile[];
  backdrops?: TmdbFile[];
  logos?: TmdbFile[];
}

/** Best-rated first; English and language-less (text-free) art preferred. */
const rank = (files: TmdbFile[] = []) => [...files].sort((a, b) => Number(b.iso_639_1 === 'en' || !b.iso_639_1) - Number(a.iso_639_1 === 'en' || !a.iso_639_1) || (b.vote_average ?? 0) - (a.vote_average ?? 0));
const url = (f: TmdbFile) => `${IMG}/original${f.file_path}`;

export function createMoviesProvider(relay: string | undefined = RELAY): Provider {
  const enabled = !!relay;
  const viaRelay = (path: string) => through(relay!, path);
  return {
    id: 'movies',
    label: 'Movies',
    placeholder: 'Search movies…',
    mediaType: 'movie',
    available: enabled,
    unavailableReason: 'Movie search needs a TMDB relay: set VITE_TMDB_PROXY_URL to a Worker that holds your TMDB token (see the README).',

    async search(query, signal): Promise<SearchResult[]> {
      const term = query.trim();
      if (!term || !enabled) return [];
      const data = await fetchJson<TmdbSearch>(viaRelay(`/search/movie?query=${encodeURIComponent(term)}&include_adult=false`), { signal });
      return (data.results ?? []).slice(0, 12).map((m) => ({
        id: String(m.id),
        title: m.title,
        subtitle: m.original_title && m.original_title !== m.title ? m.original_title : undefined,
        year: m.release_date?.slice(0, 4),
        thumbnail: m.poster_path ? `${IMG}/w92${m.poster_path}` : undefined,
        payload: { poster: m.poster_path ?? '' },
      }));
    },

    async createItem(result, signal): Promise<MediaItem> {
      const images = await fetchJson<TmdbImages>(viaRelay(`/movie/${result.id}/images?include_image_language=en,null`), { signal });
      const posters = rank(images.posters);
      const backdrops = rank(images.backdrops);
      const logos = rank(images.logos);
      const cover = posters[0] ? url(posters[0]) : result.payload?.poster ? `${IMG}/original${result.payload.poster}` : null;
      if (!cover) throw new Error('No poster found for this movie.');
      return {
        id: `tmdb-${result.id}`,
        type: 'movie',
        title: result.title,
        subtitle: result.subtitle,
        year: result.year,
        sourceId: result.id,
        assets: {
          cover,
          hero: backdrops[0] ? url(backdrops[0]) : null,
          logo: logos[0] ? url(logos[0]) : null,
          // Alternate posters first, then the rest of the backdrops.
          screenshots: [...posters.slice(1, 5), ...backdrops.slice(1, 7)].map(url),
        },
      };
    },
  };
}

export const moviesProvider = createMoviesProvider();
