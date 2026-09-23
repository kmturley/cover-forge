const STORAGE_KEY = 'coverforge:omdbKey';

/** A visitor's own free OMDb API key (omdbapi.com/apikey.aspx), kept only in this browser. */
export function getOmdbKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY) || null;
  } catch {
    return null;
  }
}

export function setOmdbKey(key: string): void {
  try {
    const trimmed = key.trim();
    if (trimmed) localStorage.setItem(STORAGE_KEY, trimmed);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // private window or full storage: the key just won't be remembered next visit
  }
}
