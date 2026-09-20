import { moviesProvider } from './movies';
import { musicProvider } from './music';
import { steamProvider } from './steam';
import { tvProvider } from './tv';
import type { Provider, ProviderId } from './types';

export type { Provider, ProviderId, SearchResult } from './types';

/** Tab order in the search panel. */
export const PROVIDERS: Provider[] = [steamProvider, moviesProvider, tvProvider, musicProvider];

export const getProvider = (id: ProviderId): Provider => PROVIDERS.find((p) => p.id === id) ?? steamProvider;
