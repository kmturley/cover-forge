import type { MediaItem, MediaType } from '../../types/media';

export interface SearchResult {
  /** Unique within its provider. */
  id: string;
  title: string;
  /** Artist, developer, network… */
  subtitle?: string;
  year?: string;
  thumbnail?: string;
  /** Provider-specific data carried from search to createItem. */
  payload?: Record<string, string>;
}

export type ProviderId = 'steam' | 'movies' | 'tv' | 'music';

/** A source of media: searches a public catalogue and turns a result into a queue item with normalised artwork slots. */
export interface Provider {
  id: ProviderId;
  label: string;
  placeholder: string;
  mediaType: MediaType;
  /** false = needs configuration that isn't present; the tab explains why. */
  available: boolean;
  unavailableReason?: string;
  search(query: string, signal?: AbortSignal): Promise<SearchResult[]>;
  createItem(result: SearchResult, signal?: AbortSignal): Promise<MediaItem>;
}
