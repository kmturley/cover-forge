import type { BoxFace, TemplateConfig } from '../types/template';
import { modelSizeMm } from '../three/PreviewGeometry';
import { buildTemplateById } from './index';
import { LIBRARY, LIBRARY_GROUPS, pieceOf, piecesOf, type LibraryEntry } from './library';

/** The kind of packaging a case is, for grouping the library by format. */
export const FORMATS = ['Keep cases', 'Jewel & tape cases', 'Boxes', 'Sleeves', 'Cards & labels'] as const;
export type Format = (typeof FORMATS)[number];

/** Which way a case's front is longer. */
export const ORIENTATIONS = ['Portrait', 'Square', 'Landscape'] as const;
export type Orientation = (typeof ORIENTATIONS)[number];

export type SortKey = 'name' | 'height' | 'width' | 'depth';
/** `media` is the library's own groups (Games, Movies & TV, …). */
export type GroupBy = 'media' | 'format' | 'orientation' | 'none';
export type Facing = 'front' | 'spine';

/** A library entry with the real size and shape of the case it prints for. */
export interface SizedEntry {
  entry: LibraryEntry;
  /** The template it is shown with: its own default Type (the insert, or the box for a case that is only a box). */
  template: TemplateConfig;
  /** The case's outside size in mm, front on: width × height, and depth (the spine). */
  widthMm: number;
  heightMm: number;
  depthMm: number;
  format: Format;
  orientation: Orientation;
  /** The face the spine is printed on, or null for one with none (cards, stickers). */
  spineFace: BoxFace | null;
}

/** Fronts within this much of square (as a fraction of the longer side) count as square. */
const SQUARE_TOLERANCE = 0.05;

export function orientationOf(widthMm: number, heightMm: number): Orientation {
  if (Math.abs(widthMm - heightMm) <= SQUARE_TOLERANCE * Math.max(widthMm, heightMm)) return 'Square';
  return heightMm > widthMm ? 'Portrait' : 'Landscape';
}

function formatOf(entry: LibraryEntry, t: TemplateConfig): Format {
  const spec = t.preview;
  if (spec.kind === 'slab') return 'Cards & labels';
  if (entry.kind === 'vinyl') return 'Sleeves';
  if (pieceOf(t.id) === 'box') return 'Boxes';
  // A jewel case has a spine card at each side of its tray; a cassette's case is the same kind of hinged box.
  if (entry.kind === 'cassette' || entry.kind === 'cd' || (spec.faces['+x'] && spec.faces['-x'])) return 'Jewel & tape cases';
  return 'Keep cases';
}

function spineFaceOf(t: TemplateConfig): BoxFace | null {
  const spec = t.preview;
  if (spec.kind !== 'box') return null;
  const hit = (Object.entries(spec.faces) as [BoxFace, string][]).find(([, panel]) => panel === 'spine');
  return hit?.[0] ?? null;
}

export function sizeEntry(entry: LibraryEntry): SizedEntry {
  const pieces = piecesOf(entry.id);
  const template = buildTemplateById(pieces.insert ?? pieces.box ?? entry.id);
  const [widthMm, heightMm, depthMm] = modelSizeMm(template.preview);
  return { entry, template, widthMm, heightMm, depthMm, format: formatOf(entry, template), orientation: orientationOf(widthMm, heightMm), spineFace: spineFaceOf(template) };
}

let sized: SizedEntry[] | null = null;
/** Every template in the library with its size, in library order (built once, on first use). */
export function sizedLibrary(): SizedEntry[] {
  return (sized ??= LIBRARY.map(sizeEntry));
}

const SIZE: Record<Exclude<SortKey, 'name'>, (c: SizedEntry) => number> = { height: (c) => c.heightMm, width: (c) => c.widthMm, depth: (c) => c.depthMm };
const byName = (a: SizedEntry, b: SizedEntry) => a.entry.name.localeCompare(b.entry.name, 'en', { numeric: true, sensitivity: 'base' });

/** Entries in order of their name (A to Z), or of one dimension (smallest first, ties by name). */
export function sortEntries(list: SizedEntry[], key: SortKey): SizedEntry[] {
  if (key === 'name') return [...list].sort(byName);
  return [...list].sort((a, b) => SIZE[key](a) - SIZE[key](b) || byName(a, b));
}

/**
 * Entries split into groups, in the groups' own order, empty groups left out; with no grouping, one unnamed group.
 * `mediaOrder` is the order of the library's groups when grouping by media (the recommended one first).
 */
export function groupEntries(list: SizedEntry[], by: GroupBy, mediaOrder: readonly string[] = LIBRARY_GROUPS): { name: string; entries: SizedEntry[] }[] {
  if (by === 'none') return [{ name: '', entries: list }];
  const names: readonly string[] = by === 'media' ? mediaOrder : by === 'format' ? FORMATS : ORIENTATIONS;
  const of = (c: SizedEntry): string => (by === 'media' ? c.entry.group : by === 'format' ? c.format : c.orientation);
  return names.map((name) => ({ name, entries: list.filter((c) => of(c) === name) })).filter((g) => g.entries.length > 0);
}

/** How wide a case is along the row when it faces the viewer: its front's width, or its depth when the spine faces out. */
export const footprintMm = (c: SizedEntry, facing: Facing) => (facing === 'front' ? c.widthMm : c.depthMm);

/** Gap between neighbouring cases and between groups, in mm. */
export const CASE_GAP_MM = 20;
export const GROUP_GAP_MM = 90;
/** With spines facing, cases stand twice as far apart, so seen from an angle each one's front shows beside its spine. */
export const caseGapMm = (facing: Facing) => (facing === 'spine' ? 2 * CASE_GAP_MM : CASE_GAP_MM);

export interface Placed {
  item: SizedEntry;
  /** Centre of the case along the row, in mm from the row's start. */
  xMm: number;
  group: string;
}

/** Lays the groups out left to right along one row, each case its footprint wide; returns the positions and the row's length. */
export function layoutRow(groups: { name: string; entries: SizedEntry[] }[], facing: Facing): { placed: Placed[]; lengthMm: number } {
  const placed: Placed[] = [];
  const gap = caseGapMm(facing);
  let x = 0;
  groups.forEach((g, gi) => {
    if (gi > 0) x += GROUP_GAP_MM - gap;
    for (const c of g.entries) {
      const w = footprintMm(c, facing);
      placed.push({ item: c, xMm: x + w / 2, group: g.name });
      x += w + gap;
    }
  });
  return { placed, lengthMm: Math.max(0, x - gap) };
}
