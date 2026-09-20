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
  image: string;
  thumbnails: Record<string, string>;
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
    const data = await fetchJson<MbResponse>(`${MB}/release-group/?query=${encodeURIComponent(term)}&fmt=json&limit=12`, { signal, retries: 3 });
    return (data['release-groups'] ?? []).map((g) => ({
      id: g.id,
      title: g.title,
      subtitle: [g['artist-credit']?.map((a) => a.name).join(', '), g['primary-type']].filter(Boolean).join(' · '),
      year: g['first-release-date']?.slice(0, 4),
      // Not every release has art; the thumbnail simply doesn't show when it doesn't.
      thumbnail: `${CAA}/release-group/${g.id}/front-250`,
      payload: { artist: g['artist-credit']?.[0]?.name ?? '' },
    }));
  },

  async createItem(result, signal): Promise<MediaItem> {
    let images: CaaImage[];
    try {
      images = (await fetchJson<{ images: CaaImage[] }>(`${CAA}/release-group/${result.id}`, { signal })).images;
    } catch (e) {
      if (e instanceof HttpError && e.status === 404) throw new Error('No cover art for this album on the Cover Art Archive.', { cause: e });
      throw e;
    }
    if (!images.length) throw new Error('No cover art for this album on the Cover Art Archive.');
    const front = images.find((i) => i.front) ?? images[0];
    const back = images.find((i) => i.back && i !== front);
    return {
      id: `mb-${result.id}`,
      type: 'music',
      title: result.title,
      subtitle: result.payload?.artist || undefined,
      year: result.year,
      sourceId: result.id,
      assets: {
        cover: bestUrl(front),
        // The back cover becomes the Back panel's default image; booklet pages, discs etc. join the library.
        hero: back ? bestUrl(back) : null,
        logo: null,
        screenshots: images.filter((i) => i !== front && i !== back).slice(0, 10).map(bestUrl),
      },
    };
  },
};
