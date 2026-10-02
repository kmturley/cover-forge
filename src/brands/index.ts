import { BRANDS } from './brands.generated';
import { LOGOS } from './logos.generated';
import type { Brand, BrandCategory, Logo } from './types';

export type { Brand, BrandCategory, Logo };
export { BRANDS, LOGOS };

const byId = new Map(BRANDS.map((b) => [b.id, b]));

export const getBrand = (id: string | null | undefined): Brand | undefined => (id ? byId.get(id) : undefined);

export const BRAND_GROUPS: { category: BrandCategory; label: string; brands: Brand[] }[] = [
  { category: 'store', label: 'Stores', brands: BRANDS.filter((b) => b.category === 'store') },
  { category: 'platform', label: 'Consoles & platforms', brands: BRANDS.filter((b) => b.category === 'platform') },
];

export const brandWidth = (b: Brand) => b.bbox[2] - b.bbox[0];
export const brandHeight = (b: Brand) => b.bbox[3] - b.bbox[1];
export const brandAspect = (b: Brand) => brandWidth(b) / brandHeight(b);

const paths = new Map<string, Path2D>();
/** Path2D is created lazily and cached (it only exists in browsers, not in the Node test environment). */
export function brandPath2D(b: Brand): Path2D {
  let p = paths.get(b.id);
  if (!p) paths.set(b.id, (p = new Path2D(b.path)));
  return p;
}

const logosById = new Map(LOGOS.map((l) => [l.id, l]));

export const getLogo = (id: string | null | undefined): Logo | undefined => (id ? logosById.get(id) : undefined);

export const logoWidth = (l: Logo) => l.bbox[2] - l.bbox[0];
export const logoHeight = (l: Logo) => l.bbox[3] - l.bbox[1];

const layerPaths = new Map<string, Path2D[]>();
/** One Path2D per layer, created lazily and cached. */
export function logoPaths2D(l: Logo): Path2D[] {
  let p = layerPaths.get(l.id);
  if (!p) layerPaths.set(l.id, (p = l.layers.map((layer) => new Path2D(layer.d))));
  return p;
}
