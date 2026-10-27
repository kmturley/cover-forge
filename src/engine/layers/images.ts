import type { MediaItem } from '../../types/media';
import type { Asset, ImageLayer, Layer } from '../../types/layers';
import { defaultImageRef, resolveImageRef } from '../imageLibrary';
import { svgImageUrl } from '../svgTemplate';

export type Assets = Readonly<Record<string, Asset>>;

/** The URL (or `local:` reference) an asset loads from. */
export const assetUrl = (a: Asset | undefined): string | null => (a ? (a.source.kind === 'url' ? a.source.url : a.source.ref) : null);

/**
 * The image an image layer shows: an item's library image (its own choice, or the panel's preferred one when the item
 * doesn't have the one chosen), or an asset. A vector mark has no image URL.
 */
export function layerImageUrl(l: ImageLayer, item: MediaItem | null, assets: Assets | undefined): string | null {
  const s = l.source;
  if (!s || s.kind === 'vector') return null;
  if (s.kind === 'asset') return assetUrl(assets?.[s.id]);
  const auto = () => (item ? resolveImageRef(item, defaultImageRef(l.target === 'canvas' ? 'front' : l.target, item)) : null);
  if (s.ref === 'auto') return auto();
  return (item && resolveImageRef(item, s.ref)) || auto();
}

/** Every image the layers need loaded before a synchronous render is complete. */
export function layerImageUrls(layers: readonly Layer[], item: MediaItem | null, assets: Assets | undefined): string[] {
  const urls = new Set<string>();
  for (const l of layers) {
    if (!l.visible) continue;
    const u = l.type === 'image' ? layerImageUrl(l, item, assets) : l.type === 'generated' && l.generator === 'svg' && item ? svgImageUrl(l.params.svg, item) : null;
    if (u) urls.add(u);
  }
  return [...urls];
}
