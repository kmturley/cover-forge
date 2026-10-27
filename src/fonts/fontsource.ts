/**
 * Google Fonts, through Fontsource (https://fontsource.org): its catalogue API lists about 2,100 families with no key,
 * and serves each font's files from a CDN. Both allow requests from any web page. Nothing is bundled, so there is no
 * list to keep up to date, and only the fonts a design uses are ever downloaded.
 */
const API = 'https://api.fontsource.org/v1/fonts';
const CDN = 'https://cdn.jsdelivr.net/fontsource/fonts';

export interface FontMeta {
  id: string;
  family: string;
  subsets: string[];
  weights: number[];
  styles: string[];
  category: string;
  license: string;
  /** Per subset, the characters it covers (a CSS unicode-range). Only on a single font's record. */
  unicodeRange?: Record<string, string>;
}

/** Fontsource's id for a family: lower case, words joined by hyphens ("DM Serif Display" is `dm-serif-display`). */
export const slug = (family: string): string => family.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The first family named in a CSS font-family value: `"Press Start 2P", sans-serif` gives `Press Start 2P`. */
export function familyOf(css: string): string {
  const first = css.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '');
}

/** The generic family to fall back on while (or if) a font isn't loaded. */
export function fallbackFor(category: string): string {
  return category === 'serif' ? 'serif' : category === 'monospace' ? 'monospace' : category === 'handwriting' ? 'cursive' : 'sans-serif';
}

/** The CSS value to store for a catalogue font. */
export const cssFamily = (family: string, category: string): string => `"${family}", ${fallbackFor(category)}`;

/** The weight a font has that is closest to the one asked for (a tie goes to the heavier). */
export function nearestWeight(weights: readonly number[], want: number): number {
  if (weights.length === 0) return want;
  return [...weights].sort((a, b) => Math.abs(a - want) - Math.abs(b - want) || b - a)[0];
}

// The ranges are the ones Google Fonts' own subsets cover. A few contain combining marks, which the regex rule dislikes in classes.
/* eslint-disable no-misleading-character-class */
const RANGES: [string, RegExp][] = [
  ['latin-ext', /[Ā-ʯḀ-ỿⱠ-Ɀ꜠-ꟿ]/],
  ['vietnamese', /[ĂăĐđĨĩŨũƠơƯưẠ-ỹ]/],
  ['cyrillic', /[Ѐ-џҐґҰұ№]/],
  ['cyrillic-ext', /[Ѡ-ԯᲀ-ᲊⷠ-ⷿꙀ-ꚟ]/],
  ['greek', /[Ͱ-Ͽ]/],
  ['greek-ext', /[ἀ-῿]/],
];
/* eslint-enable no-misleading-character-class */

/** The subsets, besides Latin, that some text needs. (Chinese, Japanese and Korean fonts are split into many large pieces and are not covered.) */
export function subsetsFor(text: string): string[] {
  return RANGES.filter(([, re]) => re.test(text)).map(([name]) => name);
}

export const fontUrl = (id: string, subset: string, weight: number, style: string): string => `${CDN}/${id}@latest/${subset}-${weight}-${style}.woff2`;

const metas = new Map<string, Promise<FontMeta | null>>();

/** One family's record, or null when there isn't one or Fontsource can't be reached. Cached. */
export function fetchMeta(id: string): Promise<FontMeta | null> {
  let p = metas.get(id);
  if (!p) {
    p = fetch(`${API}/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<FontMeta>) : null))
      .catch(() => null);
    metas.set(id, p);
    // A failed lookup shouldn't stick: the connection may come back.
    void p.then((m) => m === null && metas.delete(id));
  }
  return p;
}

let catalogue: Promise<FontMeta[] | null> | undefined;

/** Every family Fontsource has that comes from Google Fonts (icon fonts left out), or null when it can't be reached. Cached. */
export function fetchCatalogue(): Promise<FontMeta[] | null> {
  catalogue ??= fetch(API)
    .then((r) => (r.ok ? (r.json() as Promise<(FontMeta & { type?: string })[]>) : null))
    .then((all) => all && all.filter((f) => f.type !== 'other' && f.category !== 'icons' && f.subsets.includes('latin')))
    .catch(() => null)
    .then((list) => {
      if (list === null) catalogue = undefined;
      return list;
    });
  return catalogue;
}
