import { SYSTEM_FONTS } from './recommended';
import { familyOf, fetchMeta, fontUrl, nearestWeight, slug, subsetsFor } from './fontsource';

export interface FontRequest {
  /** A CSS font-family value or a family name. */
  family: string;
  weight: number;
  italic: boolean;
  /** What will be drawn with it, so only the character sets it needs are fetched. */
  text: string;
}

const GENERIC = new Set(['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);
const SYSTEM = new Set([...SYSTEM_FONTS.map(([css]) => familyOf(css).toLowerCase()), 'arial', 'helvetica', 'georgia', 'impact', 'courier new', 'arial black', 'times new roman', 'verdana', 'tahoma']);

/** True for the fonts every device has, which never need loading. */
export const isSystemFont = (family: string): boolean => {
  const f = familyOf(family).toLowerCase();
  return GENERIC.has(f) || SYSTEM.has(f);
};

const faces = new Map<string, Promise<boolean>>();

function loadFace(family: string, id: string, subset: string, weight: number, style: string, unicodeRange?: string): Promise<boolean> {
  const key = `${family}|${subset}|${weight}|${style}`;
  let p = faces.get(key);
  if (!p) {
    const face = new FontFace(family, `url(${fontUrl(id, subset, weight, style)})`, { weight: String(weight), style, ...(unicodeRange && { unicodeRange }) });
    p = face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
        return true;
      },
      () => false,
    );
    faces.set(key, p);
    // A failed file shouldn't be remembered as missing for good (it may be a dropped connection), but a font with no such subset will fail again, cheaply.
    void p.then((ok) => ok || faces.delete(key));
  }
  return p;
}

/**
 * Makes sure a Google font is ready to draw with, loading just its Latin files plus whatever other character sets the
 * text needs. Resolves true when it is usable and false when it isn't (offline, unknown family): drawing then uses the
 * font's fallback. System fonts, and a page with no font loading (a test), resolve true at once. Never rejects.
 */
export async function ensureFont({ family, weight, italic, text }: FontRequest): Promise<boolean> {
  if (typeof document === 'undefined' || !('fonts' in document) || typeof FontFace === 'undefined' || isSystemFont(family)) return true;
  const name = familyOf(family);
  const id = slug(name);
  const meta = await fetchMeta(id);
  if (!meta) return false;
  const w = nearestWeight(meta.weights, weight);
  const style = italic && meta.styles.includes('italic') ? 'italic' : 'normal';
  const wanted = ['latin', ...subsetsFor(text).filter((s) => meta.subsets.includes(s))];
  const results = await Promise.all(wanted.map((s) => loadFace(meta.family, id, s, w, style, meta.unicodeRange?.[s])));
  return results[0];
}
