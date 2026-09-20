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
    data?: { name?: string; screenshots?: { path_full: string }[]; developers?: string[]; release_date?: { date?: string } };
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
    assets: await withWorkingHero(buildAssetUrls(result.appId, screenshots), result.appId),
  };
}

/** Whether an image URL loads (browser only; assumed to load elsewhere). */
function loads(url: string): Promise<boolean> {
  if (typeof Image === 'undefined') return Promise.resolve(true);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Some games have no `library_hero_2x.jpg` (Steam answers 404); fall back to the 1x hero, or none. */
async function withWorkingHero(assets: AssetSlots, appId: number): Promise<AssetSlots> {
  if (!assets.hero || (await loads(assets.hero))) return assets;
  const smaller = `${CDN}/${appId}/library_hero.jpg`;
  return { ...assets, hero: (await loads(smaller)) ? smaller : null };
}

/** Looks a game up by its Steam app id (for links like `?app=1091500`); null if Steam doesn't know it. */
export async function fetchGameById(appId: number): Promise<MediaItem | null> {
  try {
    const res = await fetch(proxied(`https://store.steampowered.com/api/appdetails?appids=${appId}`));
    if (!res.ok) return null;
    const entry = ((await res.json()) as AppDetailsResponse)[appId];
    if (!entry?.success || !entry.data?.name) return null;
    return await createGameItem({ appId, name: entry.data.name, thumbnail: '' });
  } catch {
    return null;
  }
}
