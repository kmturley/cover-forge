import type { MediaItem } from '../types/media';
import { sanitizeDiff } from '../engine/layers/sanitize';

/** The queue is kept alphabetical by title, so exports and the list agree. */
export function sortItems(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
}

/** Older sessions stored TV shows as movies; their ids still start with `tv-`. */
export function migrateItem(item: MediaItem): MediaItem {
  const out: MediaItem = item.type === 'movie' && item.id.startsWith('tv-') ? { ...item, type: 'tv' } : item;
  if (!('diff' in out)) return out;
  // Layer changes come from a save or a link, so they are checked before anything draws them.
  const { diff: raw, ...rest } = out;
  const diff = sanitizeDiff(raw);
  return diff ? { ...rest, diff } : rest;
}
