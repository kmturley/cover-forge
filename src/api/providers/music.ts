import type { MediaItem } from '../../types/media';
import { HttpError, fetchJson, https } from '../http';
import type { Provider, SearchResult } from './types';

const MB = 'https://musicbrainz.org/ws/2';
const CAA = 'https://coverartarchive.org';

interface MbResponse {
  'release-groups'?: {
    id: string;
    title: string;
    'primary-type'?: string;
    'first-release-date'?: string;
    'artist-credit'?: { name: string }[];
  }[];
}

interface CaaImage {
  front: boolean;
  back: boolean;
  /** What the scan shows: "Front", "Back", "Tray", "Booklet", "Medium" (the disc), "Spine"… */
  types?: string[];
  image: string;
  thumbnails: Record<string, string>;
}

/** Asking for more than are shown leaves enough once the ones without art are dropped. */
const SEARCH_LIMIT = 24;

const art = new Map<string, Promise<CaaImage[] | 'none' | null>>();

/** An album's scans, `'none'` when the archive has none, or null when it couldn't be asked (offline, busy). Remembered, so adding it needn't ask again. */
function artOf(id: string, signal?: AbortSignal): Promise<CaaImage[] | 'none' | null> {
  let p = art.get(id);
  if (!p) {
    p = fetchJson<{ images: CaaImage[] }>(`${CAA}/release-group/${id}`, { signal })
      .then((r) => (r.images?.length ? r.images : ('none' as const)))
      .catch((e: unknown) => (e instanceof HttpError && e.status === 404 ? ('none' as const) : null));
    art.set(id, p);
    // Only a clear answer is kept; a failure may pass.
    void p.then((r) => r === null && art.delete(id));
  }
  return p;
}

/** The largest thumbnail Cover Art Archive makes (1200 px), falling back to the original scan. */
const bestUrl = (i: CaaImage) => https(i.thumbnails['1200'] ?? i.thumbnails.large ?? i.image);

export const musicProvider: Provider = {
  id: 'music',
  label: 'Music',
  placeholder: 'Search albums…',
  mediaType: 'music',
  available: true,

  async search(query, signal): Promise<SearchResult[]> {
    const term = query.trim();
    if (!term) return [];
    // MusicBrainz asks clients to stay under one request a second and answers 503 when busy.
    const data = await fetchJson<MbResponse>(`${MB}/release-group/?query=${encodeURIComponent(term)}&fmt=json&limit=${SEARCH_LIMIT}`, { signal, retries: 3 });
    // Many albums have no scans, so only the ones with art are offered (an album that can't be checked stays in).
    const checked = await Promise.all((data['release-groups'] ?? []).map(async (g) => ((await artOf(g.id, signal)) === 'none' ? null : g)));
    return checked.filter((g) => g !== null).slice(0, 12).map((g) => ({
      id: g.id,
      title: g.title,
      subtitle: [g['artist-credit']?.map((a) => a.name).join(', '), g['primary-type']].filter(Boolean).join(' · '),
      year: g['first-release-date']?.slice(0, 4),
      thumbnail: `${CAA}/release-group/${g.id}/front-250`,
      payload: { artist: g['artist-credit']?.[0]?.name ?? '' },
    }));
  },

  async createItem(result, signal): Promise<MediaItem> {
    const images = await artOf(result.id, signal);
    if (images === 'none' || !images?.length) throw new Error('No cover art for this album on the Cover Art Archive.');
    const front = images.find((i) => i.front) ?? images[0];
    // The back cover, else the tray card (a jewel case's back), else any other scan but the disc itself. With only
    // the front, the Back panel reuses it (see defaultImageRef).
    const others = images.filter((i) => i !== front);
    const is = (i: CaaImage, type: string) => i.types?.includes(type);
    const back = others.find((i) => i.back || is(i, 'Back')) ?? others.find((i) => is(i, 'Tray')) ?? others.find((i) => !is(i, 'Medium'));
    return {
      id: `mb-${result.id}`,
      type: 'music',
      title: result.title,
      subtitle: result.payload?.artist || undefined,
      year: result.year,
      sourceId: result.id,
      assets: {
        cover: bestUrl(front),
        // The back becomes the Back panel's default image; booklet pages, discs etc. join the library.
        hero: back ? bestUrl(back) : null,
        logo: null,
        screenshots: images.filter((i) => i !== front && i !== back).slice(0, 10).map(bestUrl),
      },
    };
  },
};
