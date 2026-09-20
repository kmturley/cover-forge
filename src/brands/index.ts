import { BRANDS } from './brands.generated';
import type { Brand, BrandCategory } from './types';

export type { Brand, BrandCategory };
export { BRANDS };

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
