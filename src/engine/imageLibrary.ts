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
  screenshots.forEach((url, i) => out.push({ ref: `screenshot:${i}`, label: `Screenshot ${i + 1}`, url }));
  return out;
}

export function resolveImageRef(item: MediaItem, ref: ImageRef | null): string | null {
  if (ref === null) return null;
  if (ref === 'cover' || ref === 'hero' || ref === 'logo') return item.assets[ref];
  const i = Number(ref.slice('screenshot:'.length));
  return item.assets.screenshots[i] ?? null;
}

/** What each panel shows until the user picks something else. The spine is text-only by default. */
export function defaultImageRef(id: PanelId): ImageRef | null {
  return id === 'front' ? 'cover' : id === 'back' ? 'hero' : null;
}
