import type { AssetSlots, MediaItem } from '../types/media';
import { proxied } from './corsProxy';

const CDN = 'https://shared.steamstatic.com/store_item_assets/steam/apps';

export interface SteamSearchResult {
  appId: number;
  name: string;
  thumbnail: string;
}

/** Deterministic, zero-auth Steam CDN artwork URLs. Screenshots need a separate appdetails lookup. */
export function buildAssetUrls(appId: number, screenshots: string[] = []): AssetSlots {
  return {
    cover: `${CDN}/${appId}/library_600x900_2x.jpg`,
    hero: `${CDN}/${appId}/library_hero_2x.jpg`,
    logo: `${CDN}/${appId}/logo.png`,
    screenshots,
  };
}

interface StoreSearchResponse {
  items?: { id: number; name: string; tiny_image?: string }[];
}

export async function searchGames(query: string, signal?: AbortSignal): Promise<SteamSearchResult[]> {
  const term = query.trim();
  if (!term) return [];
  const url = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`;
  const res = await fetch(proxied(url), { signal });
  if (!res.ok) throw new Error(`Steam search failed (${res.status})`);
  const data = (await res.json()) as StoreSearchResponse;
  return (data.items ?? []).map((i) => ({ appId: i.id, name: i.name, thumbnail: i.tiny_image ?? '' }));
}

interface AppDetailsResponse {
  [appId: string]: {
    success: boolean;
    data?: { screenshots?: { path_full: string }[]; developers?: string[]; release_date?: { date?: string } };
  };
}

/** Builds a queue item, best-effort enriching it with screenshots/developer/year from appdetails. */
export async function createGameItem(result: SteamSearchResult): Promise<MediaItem> {
  let screenshots: string[] = [];
  let subtitle: string | undefined;
  let year: string | undefined;
  try {
    const url = `https://store.steampowered.com/api/appdetails?appids=${result.appId}`;
    const res = await fetch(proxied(url));
    if (res.ok) {
      const entry = ((await res.json()) as AppDetailsResponse)[result.appId];
      if (entry?.success && entry.data) {
        screenshots = (entry.data.screenshots ?? []).map((s) => s.path_full);
        subtitle = entry.data.developers?.[0];
        year = entry.data.release_date?.date?.match(/\d{4}/)?.[0];
      }
    }
  } catch {
    // Artwork comes from deterministic CDN URLs, so a failed lookup only loses the extras.
  }
  return {
    id: `steam-${result.appId}`,
    sourceId: String(result.appId),
    type: 'game',
    title: result.name,
    subtitle,
    year,
    assets: buildAssetUrls(result.appId, screenshots),
  };
}
