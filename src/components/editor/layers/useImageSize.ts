import { useEffect, useState } from 'react';
import { getCachedImage, loadImage } from '../../../engine/imageCache';

/** Natural pixel size of an image once loaded (needed to know its shape for placing it). */
export function useImageSize(url: string | null) {
  const [size, setSize] = useState<{ url: string; w: number; h: number } | null>(null);
  useEffect(() => {
    if (!url) return;
    let live = true;
    void loadImage(url).then((img) => live && img && setSize({ url, w: img.naturalWidth, h: img.naturalHeight }));
    return () => {
      live = false;
    };
  }, [url]);
  const cached = getCachedImage(url);
  if (size && size.url === url) return size;
  return cached ? { url: url!, w: cached.naturalWidth, h: cached.naturalHeight } : null;
}
