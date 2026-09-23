const STORAGE_KEY = 'coverforge:tmdbKey';

/** A visitor's own free TMDB "API Read Access Token" (themoviedb.org/settings/api), kept only in this browser. */
export function getTmdbKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setTmdbKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private window or full storage: the key just won't be remembered next visit
  }
}
