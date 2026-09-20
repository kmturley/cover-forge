export type BrandCategory = 'store' | 'platform';

export interface Brand {
  /** Simple Icons slug, e.g. "steam". */
  id: string;
  label: string;
  category: BrandCategory;
  /** SVG path data in a 24×24 coordinate space, drawn with the nonzero fill rule. */
  path: string;
  /** The brand's official colour (hex, no #). */
  hex: string;
  /** Tight bounds of the path: [minX, minY, maxX, maxY]. */
  bbox: [number, number, number, number];
  /** Link to the owner's brand guidelines, when the owner publishes them. */
  guidelines?: string;
}
