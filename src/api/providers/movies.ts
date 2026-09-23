import type { MediaItem } from '../../types/media';
import { fetchJson, https } from '../http';
import type { Provider, SearchResult } from './types';
import { getOmdbKey } from './omdbKey';
import { getTmdbKey } from './tmdbKey';

/**
 * Two catalogues, tried in order. Both need an API key — there is no free, keyless movie catalogue — but they differ
 * in whether a relay server is *also* needed, because that depends on CORS, not on the key:
 *  1. TMDB, richer art (separate poster/backdrop/logo). Its API does send CORS headers (confirmed by hand — a
 *     browser can call it directly), so a personal or build-time token works with no relay at all, same as OMDb
 *     below. `VITE_TMDB_PROXY_URL` remains supported for anyone who already deployed the relay in worker/steam-proxy.js
 *     (it hides the token server-side instead of shipping it in the bundle); a visitor's own personal TMDB key (see
 *     tmdbKey.ts) always bypasses it and calls TMDB directly, since it's their key, not yours, being spent.
 *  2. OMDb (omdbapi.com), used when no TMDB access (personal key, relay or build-time token) is available. Also
 *     CORS-enabled, also just a key.
 *
 * A key can come from (checked in this order):
 *   a. a personal TMDB or OMDb key a visitor pasted into the app (kept only in that browser, see tmdbKey.ts /
 *      omdbKey.ts) — their own quota, and a personal TMDB key wins over everything below since it's the more capable
 *      catalogue; a personal OMDb key (with no personal TMDB key) opts out of a shared/relay TMDB token instead;
 *   b. `VITE_TMDB_API_KEY` / `VITE_OMDB_API_KEY`, a token *you* build the app with, working for every visitor with no
 *      setup on their part (mirrors `VITE_STEAM_PROXY_URL`'s public default: zero-config for visitors, one free key
 *      for you). It ships inside the client bundle, so it is not secret and its daily quota is shared by everyone
 *      who uses your site;
 *   c. none — the Movies tab asks a visitor for their own key (a), which then takes over for them.
 */
const RELAY = import.meta.env.VITE_TMDB_PROXY_URL as string | undefined;
/** A token baked in at build time so Movies works with no setup for visitors; see the module comment. No default — unset until you add `VITE_TMDB_API_KEY`. */
export const APP_TMDB_TOKEN = (import.meta.env.VITE_TMDB_API_KEY as string | undefined) ?? null;
/** A key baked in at build time so Movies works with no setup for visitors; see the module comment. */
export const APP_OMDB_KEY = import.meta.env.VITE_OMDB_API_KEY as string | undefined;
const TMDB_API = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';
const OMDB_API = 'https://www.omdbapi.com/';

/** Whether Movies already works for every visitor without them adding a personal key. */
export const hasSharedMovieAccess = (relay: string | undefined = RELAY, tmdbToken: string | null = APP_TMDB_TOKEN, appOmdbKey: string | undefined = APP_OMDB_KEY): boolean =>
  !!relay || !!tmdbToken || !!appOmdbKey;

/** True when search is currently riding on a build-time shared key rather than a visitor's own — worth telling them, since that quota is shared. */
export const usingSharedMovieKey = (
  relay: string | undefined = RELAY,
  tmdbToken: string | null = APP_TMDB_TOKEN,
  personalOmdbKey: string | null = getOmdbKey(),
  appOmdbKey: string | undefined = APP_OMDB_KEY,
  personalTmdbKey: string | null = getTmdbKey(),
): boolean => !personalOmdbKey && !personalTmdbKey && (!!relay || !!tmdbToken || !!appOmdbKey);

const through = (relay: string, path: string) => (relay.endsWith('/') ? `${relay}${TMDB_API}${path}` : `${relay}?url=${encodeURIComponent(`${TMDB_API}${path}`)}`);

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
const tmdbUrl = (f: TmdbFile) => `${TMDB_IMG}/original${f.file_path}`;

interface OmdbSearchItem {
  imdbID: string;
  Title: string;
  Year: string;
  Poster: string;
}
interface OmdbSearchResponse {
  Search?: OmdbSearchItem[];
  Response: 'True' | 'False';
  Error?: string;
}
interface OmdbDetail {
  Title: string;
  Year: string;
  Poster: string;
  Response: 'True' | 'False';
  Error?: string;
}

const hasPoster = (p: string | undefined) => !!p && p !== 'N/A';
/** OMDb's posters come from Amazon at a modest fixed width; asking the same image for a wider crop usually returns a larger file. */
const biggerPoster = (u: string) => https(u).replace(/\._V1_[^.]*(\.[a-z]+)$/i, '._V1_SX1000_$1');

export function createMoviesProvider(
  relay: string | undefined = RELAY,
  tmdbToken: string | null = APP_TMDB_TOKEN,
  omdbKey: string | null = getOmdbKey() ?? APP_OMDB_KEY ?? null,
  personalOmdbKey: string | null = getOmdbKey(),
  personalTmdbKey: string | null = getTmdbKey(),
): Provider {
  // A personal TMDB key always wins (it's the visitor's own key, calling TMDB directly). Otherwise a personal OMDb
  // key opts out of a shared/relay TMDB token, so it's actually the key put to use.
  const viaTmdb = !!personalTmdbKey || (!personalOmdbKey && (!!relay || !!tmdbToken));
  const viaOmdb = !viaTmdb && !!omdbKey;
  const effectiveTmdbToken = personalTmdbKey ?? tmdbToken;
  const useRelay = !!relay && !personalTmdbKey; // a personal key bypasses any relay — it's their own quota to spend
  // With a relay, it holds its own secret; without one, the token rides directly on the request (TMDB is CORS-enabled).
  const tmdbFetch = <T,>(path: string, signal?: AbortSignal) =>
    useRelay ? fetchJson<T>(through(relay!, path), { signal }) : fetchJson<T>(`${TMDB_API}${path}`, { signal, headers: { Authorization: `Bearer ${effectiveTmdbToken}` } });

  return {
    id: 'movies',
    label: 'Movies',
    placeholder: 'Search movies…',
    mediaType: 'movie',
    available: viaTmdb || viaOmdb,
    unavailableReason: 'Movies need a free key: add a free OMDb API key below, or set VITE_TMDB_API_KEY for richer artwork (see the README).',

    async search(query, signal): Promise<SearchResult[]> {
      const term = query.trim();
      if (!term) return [];
      if (viaTmdb) {
        const data = await tmdbFetch<TmdbSearch>(`/search/movie?query=${encodeURIComponent(term)}&include_adult=false`, signal);
        return (data.results ?? []).slice(0, 12).map((m) => ({
          id: String(m.id),
          title: m.title,
          subtitle: m.original_title && m.original_title !== m.title ? m.original_title : undefined,
          year: m.release_date?.slice(0, 4),
          thumbnail: m.poster_path ? `${TMDB_IMG}/w92${m.poster_path}` : undefined,
          payload: { poster: m.poster_path ?? '' },
        }));
      }
      if (viaOmdb) {
        const data = await fetchJson<OmdbSearchResponse>(`${OMDB_API}?apikey=${encodeURIComponent(omdbKey!)}&type=movie&s=${encodeURIComponent(term)}`, { signal });
        if (data.Response === 'False') {
          if (data.Error && !/movie not found/i.test(data.Error)) throw new Error(data.Error);
          return [];
        }
        return (data.Search ?? []).slice(0, 12).map((m) => ({
          id: m.imdbID,
          title: m.Title,
          year: m.Year,
          thumbnail: hasPoster(m.Poster) ? m.Poster : undefined,
          payload: {},
        }));
      }
      return [];
    },

    async createItem(result, signal): Promise<MediaItem> {
      if (viaTmdb) {
        const images = await tmdbFetch<TmdbImages>(`/movie/${result.id}/images?include_image_language=en,null`, signal);
        const posters = rank(images.posters);
        const backdrops = rank(images.backdrops);
        const logos = rank(images.logos);
        const cover = posters[0] ? tmdbUrl(posters[0]) : result.payload?.poster ? `${TMDB_IMG}/original${result.payload.poster}` : null;
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
            hero: backdrops[0] ? tmdbUrl(backdrops[0]) : null,
            logo: logos[0] ? tmdbUrl(logos[0]) : null,
            // Alternate posters first, then the rest of the backdrops.
            screenshots: [...posters.slice(1, 5), ...backdrops.slice(1, 7)].map(tmdbUrl),
          },
        };
      }
      if (viaOmdb) {
        const data = await fetchJson<OmdbDetail>(`${OMDB_API}?apikey=${encodeURIComponent(omdbKey!)}&i=${encodeURIComponent(result.id)}&plot=short`, { signal });
        if (data.Response === 'False') throw new Error(data.Error ?? 'Movie not found.');
        const cover = hasPoster(data.Poster) ? biggerPoster(data.Poster) : null;
        if (!cover) throw new Error('No poster found for this movie.');
        // OMDb gives one poster and no separate backdrop or logo art.
        return { id: `omdb-${result.id}`, type: 'movie', title: data.Title, year: data.Year?.slice(0, 4), sourceId: result.id, assets: { cover, hero: null, logo: null, screenshots: [] } };
      }
      throw new Error('Movies are not configured; see the Movies tab for how to add a free key.');
    },
  };
}

export const moviesProvider = createMoviesProvider();
