import type { TemplateConfig, TemplateKind } from '../types/template';
import { PAPER_MM, impose, type Imposition, type PaperSize, type Placement } from './imposition';

const IN = 25.4;

/**
 * A die-cut label or card sheet: a fixed grid whose positions must match the physical sheet exactly.
 * All measurements are millimetres, origin at the sheet's top-left.
 */
export interface LabelSheet {
  id: string;
  name: string;
  paper: PaperSize;
  labelWidthMm: number;
  labelHeightMm: number;
  cols: number;
  rows: number;
  marginLeftMm: number;
  marginTopMm: number;
  /** Distance from one label's left (top) edge to the next; equals the label size when there is no gap. */
  pitchXMm: number;
  pitchYMm: number;
  /** Templates this sheet is meant for. */
  kinds: TemplateKind[];
  /** false = some geometry is assumed rather than published; the UI tells the user to test-print first. */
  verified: boolean;
  note?: string;
}

/**
 * Geometry from Avery's published sizes and page margins. 5371 and 5395 are fully determined (the margins,
 * gaps and sizes add up to exactly 8.5" × 11"). 5196's size, count and margins are published but its vertical
 * pitch is not, so rows are assumed to sit edge to edge.
 */
export const LABEL_SHEETS: LabelSheet[] = [
  {
    id: 'avery-5196',
    name: 'Avery 5196 · 3.5" diskette labels (9-up)',
    paper: 'Letter',
    labelWidthMm: 2.75 * IN,
    labelHeightMm: 2.75 * IN,
    cols: 3,
    rows: 3,
    marginLeftMm: 0.125 * IN,
    marginTopMm: 0.5 * IN,
    pitchXMm: 2.75 * IN,
    pitchYMm: 2.75 * IN,
    kinds: ['floppy'],
    verified: false,
    note: "Vertical spacing is assumed (edge to edge). Print one page on plain paper and hold it against a label sheet before using real labels.",
  },
  {
    id: 'avery-5395',
    name: 'Avery 5395 · name badge labels (8-up)',
    paper: 'Letter',
    labelWidthMm: 3.375 * IN,
    labelHeightMm: (7 / 3) * IN,
    cols: 2,
    rows: 4,
    marginLeftMm: 0.6875 * IN,
    marginTopMm: 0.55 * IN,
    pitchXMm: (3.375 + 0.375) * IN,
    pitchYMm: (7 / 3 + 0.19) * IN,
    kinds: ['nfc-card'],
    verified: true,
    note: 'A CR80 card (85.6 × 54 mm) fits inside each label; portrait artwork is turned to suit.',
  },
  {
    id: 'avery-5371',
    name: 'Avery 5371 · business cards (10-up)',
    paper: 'Letter',
    labelWidthMm: 3.5 * IN,
    labelHeightMm: 2 * IN,
    cols: 2,
    rows: 5,
    marginLeftMm: 0.75 * IN,
    marginTopMm: 0.5 * IN,
    pitchXMm: 3.5 * IN,
    pitchYMm: 2 * IN,
    kinds: ['nfc-card'],
    verified: true,
    note: 'These cards are 2" tall; a CR80 card is 2.125", so the artwork is trimmed slightly top and bottom.',
  },
];

export const labelSheetsFor = (kind: TemplateKind): LabelSheet[] => LABEL_SHEETS.filter((s) => s.kinds.includes(kind));

/** A die-cut sheet takes a template only when it is one printed piece (a card with a back is printed on plain paper). */
export const fitsLabelSheet = (s: LabelSheet | undefined, t: TemplateConfig): boolean => !!s && s.kinds.includes(t.kind) && t.panels.length === 1;

export const getLabelSheet = (id: string | undefined): LabelSheet | undefined => LABEL_SHEETS.find((s) => s.id === id);

/**
 * Lays the template's single-piece artwork out on a die-cut sheet: centred on each label and cropped to the label,
 * plus any bleed that fits in the gap between labels, so it never spills onto a neighbour.
 */
export function imposeOnLabels(sheet: LabelSheet, t: TemplateConfig): Imposition {
  const paper = PAPER_MM[sheet.paper];
  const gapX = sheet.pitchXMm - sheet.labelWidthMm;
  const gapY = sheet.pitchYMm - sheet.labelHeightMm;
  // Bleed allowed past the label edge: at most the template's bleed, and at most half the gap to the next label.
  const ex = Math.min(t.bleedMm, gapX / 2);
  const ey = Math.min(t.bleedMm, gapY / 2);

  // Artwork whose orientation differs from the label's (a portrait card on landscape labels) is turned 90° clockwise.
  const rotated = t.totalWidthMm !== t.totalHeightMm && t.totalWidthMm > t.totalHeightMm !== sheet.labelWidthMm > sheet.labelHeightMm;
  const artW = rotated ? t.totalHeightMm : t.totalWidthMm;
  const artH = rotated ? t.totalWidthMm : t.totalHeightMm;

  const placements: Placement[] = [];
  const labelRects: NonNullable<Imposition['labelRects']> = [];
  let lostMm = 0; // the most trimmed artwork (beyond the bleed) cut off at any label edge
  for (let r = 0; r < sheet.rows; r++) {
    for (let c = 0; c < sheet.cols; c++) {
      const lx = sheet.marginLeftMm + c * sheet.pitchXMm;
      const ly = sheet.marginTopMm + r * sheet.pitchYMm;
      labelRects.push({ xMm: lx, yMm: ly, widthMm: sheet.labelWidthMm, heightMm: sheet.labelHeightMm });
      // Item origin such that the artwork's centre sits on the label's centre.
      const ox = lx + sheet.labelWidthMm / 2 - artW / 2;
      const oy = ly + sheet.labelHeightMm / 2 - artH / 2;
      // Printable area on the sheet, intersected with the artwork's extent.
      const x0 = Math.max(lx - ex, ox);
      const y0 = Math.max(ly - ey, oy);
      const x1 = Math.min(lx + sheet.labelWidthMm + ex, ox + artW);
      const y1 = Math.min(ly + sheet.labelHeightMm + ey, oy + artH);
      placements.push({ xMm: x0, yMm: y0, rotated, crop: { xMm: x0 - ox, yMm: y0 - oy, widthMm: x1 - x0, heightMm: y1 - y0 } });
      // Cropping deeper than the bleed cuts into the trimmed artwork itself (label smaller than the art).
      const cuts = [x0 - ox, ox + artW - x1, y0 - oy, oy + artH - y1].map((d) => d - t.bleedMm);
      lostMm = Math.max(lostMm, ...cuts);
    }
  }

  const warnings: string[] = [];
  if (lostMm > 0.05) warnings.push(`Artwork is trimmed by up to ${lostMm.toFixed(1)} mm at the label edge.`);
  if (!sheet.verified) warnings.push('Some spacing on this sheet is assumed. Test-print on plain paper first.');

  return {
    paper,
    cellWidthMm: artW,
    cellHeightMm: artH,
    placements,
    oversize: false,
    labelRects,
    warnings,
  };
}

/** The layout for the chosen output: a die-cut label sheet if one is selected, otherwise automatic multi-up on plain paper. */
export function computeLayout(t: TemplateConfig, paper: PaperSize, labelSheetId?: string): Imposition {
  const sheet = getLabelSheet(labelSheetId);
  if (sheet && fitsLabelSheet(sheet, t)) return imposeOnLabels(sheet, t);
  return impose(t.totalWidthMm, t.totalHeightMm, paper);
}
