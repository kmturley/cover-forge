import { srcOf } from '../storage/localImages';

const cache = new Map<string, HTMLImageElement | null>();
const pending = new Map<string, Promise<HTMLImageElement | null>>();

/** Synchronous lookup; returns null until the image has loaded (or if it failed). */
export function getCachedImage(url: string | null | undefined): HTMLImageElement | null {
  return url ? (cache.get(url) ?? null) : null;
}

/**
 * Loads with crossOrigin=anonymous so the canvas stays untainted for toBlob()/toDataURL().
 * Failures resolve to null (and are cached) so a missing asset never blocks rendering.
 */
export function loadImage(url: string): Promise<HTMLImageElement | null> {
  if (cache.has(url)) return Promise.resolve(cache.get(url) ?? null);
  const existing = pending.get(url);
  if (existing) return existing;
  const p = new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = srcOf(url) ?? '';
  }).then((img) => {
    cache.set(url, img);
    pending.delete(url);
    return img;
  });
  pending.set(url, p);
  return p;
}

export function loadImages(urls: (string | null | undefined)[]): Promise<unknown> {
  return Promise.all(urls.filter((u): u is string => !!u).map(loadImage));
}
