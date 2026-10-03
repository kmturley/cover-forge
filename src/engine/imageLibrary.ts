import type { MediaItem } from '../types/media';
import type { PanelId } from '../types/template';
import type { ImageRef } from '../types/editor';

export interface LibraryImage {
  ref: ImageRef;
  label: string;
  url: string;
}

/** Every image the item offers, in display order. */
export function libraryImages(item: MediaItem): LibraryImage[] {
  const out: LibraryImage[] = [];
  const { cover, hero, logo, screenshots } = item.assets;
  if (cover) out.push({ ref: 'cover', label: 'Cover', url: cover });
  if (hero) out.push({ ref: 'hero', label: 'Hero', url: hero });
  if (logo) out.push({ ref: 'logo', label: 'Logo', url: logo });
  screenshots.forEach((url, i) => out.push({ ref: `screenshot:${i}`, label: `Image ${i + 1}`, url }));
  return out;
}

export function resolveImageRef(item: MediaItem, ref: ImageRef | null): string | null {
  if (ref === null) return null;
  if (ref === 'cover' || ref === 'hero' || ref === 'logo') return item.assets[ref];
  const i = Number(ref.slice('screenshot:'.length));
  return item.assets.screenshots[i] ?? null;
}

/**
 * The images each panel prefers, best first. A source with several images maps a front and a back from them: the
 * cover in front and the wide hero/backdrop (or the back scan) behind, else the next image. With only one, both
 * panels show it.
 */
const PREFERENCE: Partial<Record<PanelId, ImageRef[]>> = {
  front: ['cover', 'hero', 'screenshot:0'],
  back: ['hero', 'screenshot:0', 'cover'],
};

/**
 * What a panel shows until the user picks something else: the first image it prefers that the item has. Without an
 * item, the panel's first choice. The spine is text-only by default.
 */
export function defaultImageRef(id: PanelId, item: MediaItem | null = null): ImageRef | null {
  const prefs = PREFERENCE[id];
  if (!prefs) return null;
  if (!item) return prefs[0];
  return prefs.find((ref) => resolveImageRef(item, ref)) ?? prefs[0];
}
