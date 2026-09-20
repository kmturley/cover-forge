import type { MediaItem } from '../types/media';

/** The queue is kept alphabetical by title, so exports and the list agree. */
export function sortItems(items: MediaItem[]): MediaItem[] {
  return [...items].sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base', numeric: true }));
}

/** Older sessions stored TV shows as movies; their ids still start with `tv-`. */
export function migrateItem(item: MediaItem): MediaItem {
  return item.type === 'movie' && item.id.startsWith('tv-') ? { ...item, type: 'tv' } : item;
}
