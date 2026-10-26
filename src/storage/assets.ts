import type { Asset } from '../types/layers';
import { isLocalRef, saveLocalImage, srcOf } from './localImages';
import { readImageFile } from '../api/upload';

/** SHA-256 of a file's bytes, as lowercase hex. */
export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function dimensions(blob: Blob): Promise<{ width: number; height: number } | undefined> {
  try {
    const bitmap = await createImageBitmap(blob);
    const out = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return out;
  } catch {
    return undefined;
  }
}

const newId = (): string => `asset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/**
 * An asset from a file the user chose. The bytes stay in the browser (IndexedDB), and the asset remembers the file's
 * name, size, pixel size and hash, so that if the design is opened where the bytes aren't, the file can be found again.
 */
export async function assetFromFile(file: File): Promise<Asset> {
  const ref = await readImageFile(file); // checks it is an image; keeps the original bytes
  const dims = await dimensions(file);
  return {
    id: newId(),
    name: file.name,
    source: isLocalRef(ref) ? { kind: 'local', ref } : { kind: 'url', url: ref },
    size: file.size,
    ...dims,
    hash: await sha256Hex(file),
  };
}

/** An asset that stays at a web address; only the address is stored. Throws a readable Error for anything but http(s). */
export function assetFromUrl(raw: string): Asset {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error('That isn’t a web address.');
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Only http and https addresses can be used.');
  const name = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() ?? '') || url.hostname;
  return { id: newId(), name, source: { kind: 'url', url: url.toString() } };
}

/** True for an uploaded asset whose bytes aren't in this browser (the design came from elsewhere). */
export const isMissing = (a: Asset): boolean => a.source.kind === 'local' && !srcOf(a.source.ref);

export type Match = 'hash' | 'name' | 'none';

/** How well a file the user picked fits a missing asset: the same bytes, the same name and size, or neither. */
export async function matchAsset(asset: Asset, file: File): Promise<Match> {
  if (asset.hash && (await sha256Hex(file)) === asset.hash) return 'hash';
  return asset.name === file.name && (asset.size === undefined || asset.size === file.size) ? 'name' : 'none';
}

/** The asset with the picked file's bytes in place of the missing ones. Everything that used it draws again. */
export async function relinkAsset(asset: Asset, file: File): Promise<Asset> {
  if (!file.type.startsWith('image/')) throw new Error(`“${file.name}” isn't an image.`);
  const ref = await saveLocalImage(file);
  if (!ref) throw new Error('This browser can’t keep uploaded files (storage is blocked).');
  return { ...asset, source: { kind: 'local', ref }, size: file.size, ...(await dimensions(file)), hash: await sha256Hex(file) };
}
