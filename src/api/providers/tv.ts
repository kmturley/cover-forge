import type { MediaItem } from '../../types/media';
import { fetchJson, https } from '../http';
import type { Provider, SearchResult } from './types';

const TVMAZE = 'https://api.tvmaze.com';

interface Show {
  id: number;
  name: string;
  premiered?: string | null;
  network?: { name: string } | null;
  webChannel?: { name: string } | null;
  genres?: string[];
  image?: { medium?: string; original?: string } | null;
}

interface TvImage {
  type: 'poster' | 'banner' | 'background' | 'typography' | string;
  main: boolean;
  resolutions: { original: { url: string } };
}

const original = (i: TvImage) => https(i.resolutions.original.url);

export const tvProvider: Provider = {
  id: 'tv',
  label: 'TV Shows',
  placeholder: 'Search TV shows…',
  mediaType: 'tv',
  available: true,

  async search(query, signal): Promise<SearchResult[]> {
    const term = query.trim();
    if (!term) return [];
    const data = await fetchJson<{ show: Show }[]>(`${TVMAZE}/search/shows?q=${encodeURIComponent(term)}`, { signal });
    return data.slice(0, 12).map(({ show }) => ({
      id: String(show.id),
      title: show.name,
      subtitle: [(show.network ?? show.webChannel)?.name, show.genres?.slice(0, 2).join('/')].filter(Boolean).join(' · '),
      year: show.premiered?.slice(0, 4),
      thumbnail: show.image?.medium ? https(show.image.medium) : undefined,
      payload: { poster: show.image?.original ? https(show.image.original) : '' },
    }));
  },

  async createItem(result, signal): Promise<MediaItem> {
    let images: TvImage[] = [];
    try {
      images = await fetchJson<TvImage[]>(`${TVMAZE}/shows/${result.id}/images`, { signal });
    } catch {
      // The show's main poster (from the search) is enough on its own.
    }
    const posters = images.filter((i) => i.type === 'poster');
    const main = posters.find((i) => i.main) ?? posters[0];
    const backdrop = images.find((i) => i.type === 'background') ?? images.find((i) => i.type === 'banner');
    const titleLogo = images.find((i) => i.type === 'typography');
    const cover = main ? original(main) : result.payload?.poster || null;
    if (!cover) throw new Error('No artwork found for this show.');
    return {
      id: `tv-${result.id}`,
      type: 'tv',
      title: result.title,
      subtitle: result.subtitle || undefined,
      year: result.year,
      sourceId: result.id,
      assets: {
        cover,
        hero: backdrop ? original(backdrop) : null,
        logo: titleLogo ? original(titleLogo) : null,
        // Alternate posters are the extra art.
        screenshots: posters.filter((i) => i !== main).slice(0, 8).map(original),
      },
    };
  },
};
