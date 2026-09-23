import { createMoviesProvider } from './movies';
import { musicProvider } from './music';
import { steamProvider } from './steam';
import { tvProvider } from './tv';
import type { Provider, ProviderId } from './types';

export type { Provider, ProviderId, SearchResult } from './types';

/**
 * Tab order in the search panel. A function (not a constant) because the Movies provider's `available` flag depends
 * on a personal OMDb key that can be added at any time (see omdbKey.ts), not just at build time.
 */
export const getProviders = (): Provider[] => [steamProvider, createMoviesProvider(), tvProvider, musicProvider];

export const getProvider = (id: ProviderId): Provider => getProviders().find((p) => p.id === id) ?? steamProvider;
