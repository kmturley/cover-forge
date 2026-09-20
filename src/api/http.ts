export interface FetchJsonOptions {
  signal?: AbortSignal;
  /** Extra attempts after a 429/503 (rate limiting / "busy"), e.g. MusicBrainz. */
  retries?: number;
  retryDelayMs?: number;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(new DOMException('Aborted', 'AbortError'))), { once: true });
  });

/** GET a JSON document, retrying politely when the server says it is busy or rate-limiting us. */
export async function fetchJson<T>(url: string, { signal, retries = 0, retryDelayMs = 1100 }: FetchJsonOptions = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { signal });
    if (res.ok) return (await res.json()) as T;
    if ((res.status === 429 || res.status === 503) && attempt < retries) {
      await sleep(retryDelayMs * (attempt + 1), signal); // back off a little more each time
      continue;
    }
    throw new HttpError(res.status, res.status === 429 || res.status === 503 ? 'The service is busy right now. Try again in a moment.' : `Request failed (${res.status})`);
  }
}

/** Upgrades http:// image links (some APIs still return them); browsers block mixed content. */
export const https = (url: string) => url.replace(/^http:\/\//, 'https://');
