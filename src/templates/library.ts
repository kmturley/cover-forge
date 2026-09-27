import type { MediaType } from '../types/media';
import type { TemplateConfig, TemplateKind } from '../types/template';
import { TEMPLATE_DEFS } from './definitions';

/** Groups the library is shown in, in display order. */
export const LIBRARY_GROUPS = ['Games', 'Movies & TV', 'Music', 'Labels, cards & NFC'] as const;
export type LibraryGroup = (typeof LIBRARY_GROUPS)[number];

/** One pickable template: a kind in one of its variants. Its id is the built TemplateConfig's id (`${kind}-${variantId}`). */
export interface LibraryEntry {
  id: string;
  kind: TemplateKind;
  variantId: string;
  /** Its common name, e.g. "Blu-ray Elite" or "PS4" (the variant's label); sizes are in `size`. */
  name: string;
  /** Short label for tight spots such as the queue: the platform for game cases, else the format ("Blu-ray"). */
  short: string;
  group: LibraryGroup;
  /** Front size and spine, e.g. "135 × 170 mm · 14.5 mm spine". */
  size: string;
  /** Lower-case text the search matches against. */
  keywords: string;
}

const GROUP_OF: Record<TemplateKind, LibraryGroup> = {
  'game-case': 'Games',
  dvd: 'Movies & TV',
  bluray: 'Movies & TV',
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

export const LIBRARY: LibraryEntry[] = TEMPLATE_DEFS.flatMap((def) =>
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
      keywords: [name, def.name, v.id, GROUP_OF[def.kind], maker].join(' ').toLowerCase(),
    };
  }),
);

const byId = new Map(LIBRARY.map((e) => [e.id, e]));

export const getEntry = (id: string | null | undefined): LibraryEntry | undefined => (id ? byId.get(id) : undefined);
export const isTemplateId = (id: unknown): id is string => typeof id === 'string' && byId.has(id);

/** Templates that were removed or renamed, and what saves and links that used them get instead. */
const REPLACED: Record<string, string> = {
  'bluray-eu-14': 'bluray-us-11', // only US cases are supported
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

export function suits(entry: LibraryEntry, type: MediaType): boolean {
  const media = MEDIA_OF[entry.group];
  return type === 'custom' || media === 'any' || media.includes(type);
}

/** The case last picked for each media type; new items of that type start with it. */
export type LastTemplates = Partial<Record<MediaType, string>>;

/**
 * What an item's original release came in. Without release data per platform this is the obvious one per source:
 * Steam games are PC, films and TV are DVD, music is a CD.
 */
const ORIGINAL: Record<Exclude<MediaType, 'custom'>, string> = {
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
