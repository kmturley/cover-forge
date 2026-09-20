export type PaperSize = 'A4' | 'Letter';

export const PAPER_MM: Record<PaperSize, { widthMm: number; heightMm: number }> = {
  A4: { widthMm: 210, heightMm: 297 },
  Letter: { widthMm: 215.9, heightMm: 279.4 },
};

export interface Placement {
  xMm: number;
  yMm: number;
  /** Rotated 90° clockwise on the sheet. */
  rotated: boolean;
}

export interface Imposition {
  paper: { widthMm: number; heightMm: number };
  /** Footprint of one item on the sheet, after any rotation. */
  cellWidthMm: number;
  cellHeightMm: number;
  placements: Placement[];
  /** True when even one item doesn't fit at 100% (the single placement is then not to scale). */
  oversize: boolean;
}

export interface ImpositionOptions {
  marginMm?: number;
  gutterMm?: number;
}

function grid(paperW: number, paperH: number, w: number, h: number, margin: number, gutter: number) {
  const cols = Math.max(0, Math.floor((paperW - margin * 2 + gutter) / (w + gutter)));
  const rows = Math.max(0, Math.floor((paperH - margin * 2 + gutter) / (h + gutter)));
  return { cols, rows };
}

/** Lays out as many copies of a w×h item per sheet as fit, trying both orientations and centring the grid. */
export function impose(
  itemWidthMm: number,
  itemHeightMm: number,
  paper: PaperSize,
  { marginMm = 2, gutterMm = 2 }: ImpositionOptions = {},
): Imposition {
  const { widthMm: pw, heightMm: ph } = PAPER_MM[paper];
  const upright = grid(pw, ph, itemWidthMm, itemHeightMm, marginMm, gutterMm);
  const turned = grid(pw, ph, itemHeightMm, itemWidthMm, marginMm, gutterMm);
  const useTurned = turned.cols * turned.rows > upright.cols * upright.rows;
  const { cols, rows } = useTurned ? turned : upright;
  const cw = useTurned ? itemHeightMm : itemWidthMm;
  const ch = useTurned ? itemWidthMm : itemHeightMm;

  if (cols * rows === 0) {
    // Nothing fits at 100%: centre one copy in whichever orientation is closer to fitting; caller must scale.
    return {
      paper: { widthMm: pw, heightMm: ph },
      cellWidthMm: itemWidthMm,
      cellHeightMm: itemHeightMm,
      placements: [{ xMm: (pw - itemWidthMm) / 2, yMm: (ph - itemHeightMm) / 2, rotated: false }],
      oversize: true,
    };
  }

  const gridW = cols * cw + (cols - 1) * gutterMm;
  const gridH = rows * ch + (rows - 1) * gutterMm;
  const x0 = (pw - gridW) / 2;
  const y0 = (ph - gridH) / 2;
  const placements: Placement[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      placements.push({ xMm: x0 + c * (cw + gutterMm), yMm: y0 + r * (ch + gutterMm), rotated: useTurned });
    }
  }
  return { paper: { widthMm: pw, heightMm: ph }, cellWidthMm: cw, cellHeightMm: ch, placements, oversize: false };
}

/** Splits items into sheet-sized groups. */
export function paginate<T>(items: T[], perSheet: number): T[][] {
  const n = Math.max(1, perSheet);
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += n) pages.push(items.slice(i, i + n));
  return pages;
}
