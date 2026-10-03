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

/** One filled shape of a supplied logo. */
export interface LogoLayer {
  /** SVG path data in the logo's own coordinates (before `offset`). */
  d: string;
  /** Hex colour, or 'none'. Omitted: the colour of the lockup the logo is drawn in. */
  fill?: string;
  /**
   * The shape's gradient, in the layer's own coordinates, with `fill` as its flat average fallback. Either `line`
   * (x1, y1, x2, y2: linear) or `radial` (a matrix taking the unit circle to the gradient's ellipse). Stop colours
   * may be rgba() where the gradient fades out.
   */
  gradient?: { stops: [number, string][]; line?: [number, number, number, number]; radial?: [number, number, number, number, number, number] };
  /** Outline colour (null: the lockup's colour) and width, when the shape has one. */
  stroke?: string | null;
  strokeWidth?: number;
  strokeCap?: 'butt' | 'round' | 'square';
  /** Translation applied to this layer's group in the source file. */
  offset: [number, number];
  /** Tight bounds of this layer with its offset: [minX, minY, maxX, maxY]. */
  box: [number, number, number, number];
}

/** A multi-colour logo supplied as an SVG file in src/brands/svg/. */
export interface Logo {
  /** The file's name without .svg. */
  id: string;
  label: string;
  /** Tight bounds of every layer, offsets included: [minX, minY, maxX, maxY]. */
  bbox: [number, number, number, number];
  /** Fill with the even-odd rule (holes where shapes overlap) instead of nonzero. */
  evenodd?: boolean;
  layers: LogoLayer[];
}
