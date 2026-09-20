import { saveLocalImage } from '../storage/localImages';

/** Longest side, in pixels, for the data-URL fallback used when IndexedDB isn't available. */
export const MAX_UPLOAD_SIDE = 1600;

/** Size that fits within `max` on its longest side, keeping the aspect ratio; never scales up. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/**
 * Accepts an image file and returns a URL for it. The original bytes are kept in IndexedDB (a `local:` ref), so
 * nothing is scaled or re-encoded. Only if IndexedDB is unavailable does it fall back to a downscaled data URL
 * (PNG/WebP/GIF keep transparency; everything else becomes JPEG), which has to fit in localStorage.
 */
export async function readImageFile(file: File, maxSide = MAX_UPLOAD_SIDE): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error(`“${file.name}” isn't an image.`);
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error(`Couldn't read “${file.name}” as an image.`);
  });
  const ref = await saveLocalImage(file);
  if (ref) {
    bitmap.close();
    return ref;
  }
  const { width, height } = fitWithin(bitmap.width, bitmap.height, maxSide);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const keepsAlpha = file.type === 'image/png' || file.type === 'image/webp' || file.type === 'image/gif';
  return canvas.toDataURL(keepsAlpha ? 'image/png' : 'image/jpeg', 0.88);
}
