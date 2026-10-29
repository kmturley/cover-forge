import type { MediaType } from '../types/media';
import type { Piece, TemplateConfig, TemplateKind } from '../types/template';
import { TEMPLATE_DEFS } from './definitions';
import { PIECES, PIECE_SEPARATOR, caseSpecOf } from './pieces';
import { buildTemplateById } from './index';

/** Groups the library is shown in, in display order. */
export const LIBRARY_GROUPS = ['Games', 'Movies & TV', 'Music', 'Labels, cards & NFC'] as const;
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

/** One pickable template: a kind in one of its variants. Its id is the built TemplateConfig's id (`${kind}-${variantId}`). */
export interface LibraryEntry {
  id: string;
  kind: TemplateKind;
  variantId: string;
  /** Its common name, e.g. "DVD Slim" or "PS4" (the variant's label); sizes are in `size`. */
  name: string;
  /** Short label for tight spots such as the queue: the platform for game cases, else the format ("Blu-ray"). */
  short: string;
  group: LibraryGroup;
  /** Front size and spine, e.g. "135 × 170 mm · 14.5 mm spine". */
  size: string;
  /** The standard case or format its print fits ("DVD Case", "CD Jewel Case"); null for a size of its own. */
  standard: string | null;
  /** How the library describes it: the standard's name (or "Custom") and its size, e.g. "DVD Case · 129.5 × 183 mm · 14 mm spine". */
  detail: string;
  /** Lower-case text the search matches against. */
  keywords: string;
  /** Retired: kept for saves and links that use it, but not listed or searchable. */
  hidden: boolean;
}

const GROUP_OF: Record<TemplateKind, LibraryGroup> = {
  'game-case': 'Games',
  dvd: 'Movies & TV',
  bluray: 'Movies & TV',
  uhd: 'Movies & TV',
  vhs: 'Movies & TV',
  cd: 'Music',
  vinyl: 'Music',
  cassette: 'Music',
  floppy: 'Labels, cards & NFC',
  'nfc-card': 'Labels, cards & NFC',
  'nfc-sticker': 'Labels, cards & NFC',
  'nfc-box': 'Labels, cards & NFC',
};

/** Extra search words per game platform, so "sony", "nintendo" or "microsoft" find them. */
const MAKER: Record<string, string> = { ps: 'sony playstation', switch: 'nintendo', wii: 'nintendo', gamecube: 'nintendo gcn', xbox: 'microsoft', pc: 'windows steam computer dvd' };

const mm = (n: number) => `${Math.round(n * 10) / 10}`;

function sizeOf(t: TemplateConfig): string {
  const front = t.panels.find((p) => p.id === 'front') ?? t.panels[0];
  const spine = t.panels.find((p) => p.id === 'spine');
  return `${mm(front.widthMm)} × ${mm(front.heightMm)} mm${spine ? ` · ${mm(spine.widthMm)} mm spine` : ''}`;
}

/**
 * Standard cases and formats, by the size of the printed pieces (front, and spine when there is one). A template whose
 * print matches one is named for it, so the PS2's insert reads as the DVD case it is; anything else is Custom.
 */
const STANDARDS: { name: string; front: [number, number]; spine?: number; back?: [number, number] }[] = [
  { name: 'DVD Case', front: [129.5, 183], spine: 14 },
  { name: 'DVD Slim Case', front: [129.5, 183], spine: 7 },
  { name: 'DVD Slim Case (9 mm)', front: [129.5, 183], spine: 9 },
  { name: 'Blu-ray Case', front: [128, 149], spine: 11 },
  { name: 'Blu-ray Slim Case', front: [128, 149], spine: 7 },
  { name: 'Blu-ray Elite Case', front: [128, 149], spine: 12.5 },
  { name: 'Blu-ray Case (EU)', front: [128, 149], spine: 14 },
  { name: 'CD Jewel Case', front: [120, 120], spine: 6.5, back: [137, 118] },
  { name: 'VHS Sleeve', front: [105, 190], spine: 25 },
  { name: 'Cassette J-Card', front: [65.1, 101.6], spine: 12.7 },
  { name: '12" LP Sleeve', front: [314, 314], spine: 3 },
  { name: '10" Record Sleeve', front: [262, 262], spine: 3 },
  { name: '7" Single Sleeve', front: [184, 184], spine: 3 },
  { name: '3.5" Floppy Label', front: [69.85, 69.85] },
  { name: 'CR80 Card', front: [54, 85.6] },
];

/** The standard a template's print matches, if any (see STANDARDS). */
export function standardCase(t: TemplateConfig): string | null {
  const size = (id: string) => t.panels.find((p) => p.id === id);
  const same = (p: { widthMm: number; heightMm: number } | undefined, [w, h]: [number, number]) => !!p && Math.abs(p.widthMm - w) < 0.05 && Math.abs(p.heightMm - h) < 0.05;
  const spine = size('spine');
  const hit = STANDARDS.find(
    (s) =>
      same(size('front'), s.front) &&
      (s.spine === undefined ? !spine : !!spine && Math.abs(spine.widthMm - s.spine) < 0.05) &&
      (!s.back || same(size('back'), s.back)),
  );
  return hit?.name ?? null;
}

/** Every template, retired ones included: by library group, then by name (numbers in order, so 7" before 10"). */
const ALL_ENTRIES: LibraryEntry[] = TEMPLATE_DEFS.flatMap((def) =>
  def.variants.map((v) => {
    const t = def.build(v.id);
    const game = def.kind === 'game-case';
    const name = v.label;
    const maker = game ? Object.entries(MAKER).find(([k]) => v.id.startsWith(k))?.[1] ?? '' : '';
    return {
      id: t.id,
      kind: def.kind,
      variantId: v.id,
      name,
      short: game ? v.label : def.name,
      group: GROUP_OF[def.kind],
      size: sizeOf(t),
      standard: standardCase(t),
      detail: `${standardCase(t) ?? 'Custom'} · ${sizeOf(t)}`,
      keywords: [name, def.name, v.id, GROUP_OF[def.kind], maker, standardCase(t) ?? 'custom'].join(' ').toLowerCase(),
      hidden: !!v.hidden,
    };
  }),
).sort((a, b) => LIBRARY_GROUPS.indexOf(a.group) - LIBRARY_GROUPS.indexOf(b.group) || a.name.localeCompare(b.name, 'en', { numeric: true, sensitivity: 'base' }));

/** The templates offered in the library (retired ones are left out, but still resolve by id). */
export const LIBRARY: LibraryEntry[] = ALL_ENTRIES.filter((e) => !e.hidden);

const byId = new Map(ALL_ENTRIES.map((e) => [e.id, e]));

/** A template id split into its case and its piece (a slipcover or box has a `~piece` suffix; the case's own id has none). */
export function splitId(id: string): { base: string; piece: Piece | null } {
  const at = id.indexOf(PIECE_SEPARATOR);
  const piece = at < 0 ? null : (id.slice(at + 1) as Piece);
  return at < 0 ? { base: id, piece: null } : { base: id.slice(0, at), piece: PIECES.includes(piece as Piece) ? piece : null };
}

/** Kinds that are a box already: their own template is the Box piece, and there is no insert. */
const BOX_KINDS = new Set<TemplateKind>(['vhs', 'nfc-box']);

/**
 * Cases that are one thing in two library rows: the NFC card and the box made for it. Each row's pieces are the same
 * set, so switching Type moves between them; the card is the root the slipcover is built from.
 */
const ROOT_OF: Record<string, string> = { 'nfc-box-card': 'nfc-card-cr80-duplex' };
const BOX_OF_ROOT: Record<string, string> = { 'nfc-card-cr80-duplex': 'nfc-box-card' };

/**
 * The template for each Type of a case, or null where the case has none (a sticker has no slipcover or box; a VHS box
 * has no insert). This is what the Type buttons offer, and which ids are valid.
 */
export function piecesOf(id: string): Record<Piece, string | null> {
  const none = { insert: null, slipcover: null, box: null };
  const { base } = splitId(id);
  const entry = byId.get(base);
  if (!entry) return none;
  const root = ROOT_OF[base] ?? base;
  const rootEntry = byId.get(root) ?? entry;
  const spec = caseSpecOf(buildTemplateById(root));
  const isBox = BOX_KINDS.has(rootEntry.kind);
  return {
    insert: isBox ? null : root,
    slipcover: spec ? `${root}${PIECE_SEPARATOR}slipcover` : null,
    box: isBox ? root : (BOX_OF_ROOT[root] ?? (spec ? `${root}${PIECE_SEPARATOR}box` : null)),
  };
}

/** Which Type a template id is. A case's own id is an insert, unless the case is a box (VHS, the NFC boxes). */
export function pieceOf(id: string): Piece {
  const { base, piece } = splitId(id);
  if (piece) return piece;
  const kind = byId.get(base)?.kind;
  return kind && BOX_KINDS.has(kind) ? 'box' : 'insert';
}

/** The case's entry (a slipcover or box shares its case's row in the library). */
export const getEntry = (id: string | null | undefined): LibraryEntry | undefined => (id ? byId.get(splitId(id).base) : undefined);
export const isTemplateId = (id: unknown): id is string => {
  if (typeof id !== 'string') return false;
  const { base, piece } = splitId(id);
  if (!byId.has(base)) return false;
  if (piece === null) return !id.includes(PIECE_SEPARATOR);
  return Object.values(piecesOf(base)).includes(id);
};

/** Display order: by library group, then library order; retired templates sort after their group's offered ones. */
export const LIBRARY_ORDER = new Map(ALL_ENTRIES.map((e, i) => [e.id, LIBRARY_GROUPS.indexOf(e.group) * 1000 + (e.hidden ? 500 : 0) + i]));

/** Templates that were removed or renamed, and what saves and links that used them get instead. */
const REPLACED: Record<string, string> = {
  'game-case-ps1-pal': 'game-case-ps1', // PS1 is a jewel case in every region
};

/** A saved template id brought up to date: itself if it still exists, its replacement if it was renamed, else undefined. */
export function upgradeTemplateId(id: unknown): string | undefined {
  if (isTemplateId(id)) return id;
  const next = typeof id === 'string' ? REPLACED[id] : undefined;
  return isTemplateId(next) ? next : undefined;
}

/** The entry for a kind + variant (an unknown variant falls back to the kind's first). */
export function entryFor(kind: TemplateKind, variantId?: string): LibraryEntry {
  return getEntry(`${kind}-${variantId}`) ?? LIBRARY.find((e) => e.kind === kind) ?? LIBRARY[0];
}

/** Entries whose text contains every word of the query (all of them for an empty query). */
export function searchLibrary(query: string, entries: LibraryEntry[] = LIBRARY): LibraryEntry[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return entries.filter((e) => words.every((w) => e.keywords.includes(w)));
}

/** Which media each group's cases are made for. NFC and label templates suit anything. */
const MEDIA_OF: Record<LibraryGroup, MediaType[] | 'any'> = {
  Games: ['game'],
  'Movies & TV': ['movie', 'tv'],
  Music: ['music'],
  'Labels, cards & NFC': 'any',
};

/** The library group made for a media type (none for custom items, which suit anything). */
export function groupFor(type: MediaType): LibraryGroup | null {
  return LIBRARY_GROUPS.find((g) => g !== 'Labels, cards & NFC' && (MEDIA_OF[g] as MediaType[]).includes(type)) ?? null;
}

/** The case a media type's original release came in (see ORIGINAL); none for custom items. */
export const originalTemplateFor = (type: MediaType): string | null => (type === 'custom' ? null : ORIGINAL[type]);

/** The case last picked for each media type; new items of that type start with it. */
export type LastTemplates = Partial<Record<MediaType, string>>;

/**
 * What an item's original release came in. Without release data per platform this is the obvious one per source:
 * Steam games are PC, films and TV are DVD, music is a CD.
 */
export const ORIGINAL: Record<Exclude<MediaType, 'custom'>, string> = {
  game: 'game-case-pc',
  movie: 'dvd-std-14',
  tv: 'dvd-std-14',
  music: 'cd-jewel',
};

/**
 * The template a newly added item gets: the case last picked for its media type (someone reassigning a game to PS4
 * most likely has more PS4 games to come), otherwise its original format. Custom items with neither take `fallback`.
 */
export function defaultTemplateFor(type: MediaType, last: LastTemplates, fallback: string): string {
  const recent = last[type];
  if (isTemplateId(recent)) return recent;
  return type === 'custom' ? fallback : ORIGINAL[type];
}
