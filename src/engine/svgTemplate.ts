import type { MediaItem } from '../types/media';
import { appIdOf } from '../codes/pattern';
import { variables } from './SpineTypography';

/**
 * Custom graphics: a layer holds an SVG with `{variables}` (the item's title, year…), which is filled in per item and
 * drawn as a picture. An SVG drawn as a picture can't run script or load anything from the web, so a design can carry one
 * safely; the text below still cleans it of anything that shouldn't be there, as a second line of defence for a save or
 * a link that someone has edited by hand.
 */

/** The variables an SVG can use. */
export const SVG_VARIABLES = ['title', 'creator', 'artist', 'developer', 'year', 'subtitle', 'appId', 'id'] as const;

/** The longest SVG kept, in characters. */
export const MAX_SVG_CHARS = 20_000;

const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Fills `{name}` variables with the item's values, escaped so a title can't break out of the markup. Unknown ones are left as typed. */
export function fillSvg(template: string, item: MediaItem): string {
  const values: Record<string, string> = { ...variables(item), appId: appIdOf(item), id: item.id };
  return template.replace(/\{(\w+)\}/g, (whole, key: string) => (Object.hasOwn(values, key) ? escapeXml(values[key]) : whole));
}

/** Only these kinds of picture may be embedded inside an SVG; a link out, or another SVG, is dropped. */
const SAFE_DATA = /^data:image\/(png|jpe?g|gif|webp);/i;

/**
 * The SVG with anything that could run or fetch removed: scripts, foreign content, event handlers, links to anything but
 * a part of the same graphic or a small embedded picture, imports and external urls in styles. Null when it isn't an
 * SVG at all, is too long, or declares entities (which can be used to blow a document up).
 */
export function sanitizeSvg(raw: string): string | null {
  if (typeof raw !== 'string' || raw.length > MAX_SVG_CHARS) return null;
  let s = raw.trim();
  if (/<!(DOCTYPE|ENTITY)/i.test(s)) return null;
  s = s.replace(/^<\?xml[^>]*\?>\s*/i, '').replace(/<!--[\s\S]*?-->/g, '');
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return null;
  s = s.replace(/<\s*(script|foreignObject|iframe|object|embed|audio|video|animate|set|handler)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
  s = s.replace(/<\s*(script|foreignObject|iframe|object|embed|audio|video|animate|set|handler)\b[^>]*\/?>/gi, '');
  // Event handlers, in any quoting.
  s = s.replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  // Links: keep a reference to a part of this graphic, or a small embedded picture; drop the rest.
  s = s.replace(/\s+(xlink:)?href\s*=\s*("([^"]*)"|'([^']*)')/gi, (whole, _ns, _q, dq: string | undefined, sq: string | undefined) => {
    const v = (dq ?? sq ?? '').trim();
    return v.startsWith('#') || SAFE_DATA.test(v) ? whole : '';
  });
  s = s.replace(/@import[^;}]*[;}]?/gi, '').replace(/url\(\s*(['"]?)\s*(?!#|data:image\/(png|jpe?g|gif|webp);)[^)]*\)/gi, 'none');
  s = s.replace(/javascript\s*:/gi, '');
  return /^<svg[\s>]/i.test(s) && /<\/svg>\s*$/i.test(s) ? s : null;
}

/** Width / height of an SVG, from its viewBox or its size; 1 when it says neither. */
export function svgAspect(svg: string): number {
  const vb = /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/i.exec(svg);
  const [w, h] = vb ? [Number(vb[3]), Number(vb[4])] : [parseFloat(/\swidth\s*=\s*["']([\d.]+)/i.exec(svg)?.[1] ?? ''), parseFloat(/\sheight\s*=\s*["']([\d.]+)/i.exec(svg)?.[1] ?? '')];
  return w > 0 && h > 0 ? w / h : 1;
}

/**
 * The SVG with a width and height on its root, taken from the viewBox when they're missing. Some browsers can't draw an SVG
 * picture onto a canvas without them. (The size only sets how it is rasterised; the layer's box sets how big it is drawn.)
 */
function withIntrinsicSize(svg: string): string {
  const root = /^<svg\b[^>]*>/i.exec(svg)?.[0];
  if (!root) return svg;
  const has = (a: string) => new RegExp(`\\s${a}\\s*=`, 'i').test(root);
  if (has('width') && has('height')) return svg;
  const a = svgAspect(svg);
  const [w, h] = a >= 1 ? [1000, Math.round(1000 / a)] : [Math.round(1000 * a), 1000];
  const added = `${has('width') ? '' : ` width="${w}"`}${has('height') ? '' : ` height="${h}"`}`;
  return svg.replace(/^<svg\b/i, `<svg${added}`);
}

/** An address the browser can load the SVG from, as a picture. Null when it isn't acceptable. */
export function svgImageUrl(template: string, item: MediaItem): string | null {
  const svg = sanitizeSvg(fillSvg(template, item));
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withIntrinsicSize(svg))}` : null;
}

/** Starting points that show what a custom graphic can be. They use `currentColor`-free, fixed colours so they look the same everywhere. */
export const SVG_PRESETS: { label: string; svg: string }[] = [
  {
    label: 'Ribbon banner',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 60"><path d="M0 8h300l-14 22 14 22H0l14-22z" fill="#c8102e"/><path d="M0 8h300" stroke="#fff" stroke-width="2" opacity=".5"/><text x="150" y="38" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="22" text-anchor="middle" fill="#fff">{title}</text></svg>',
  },
  {
    label: 'Edition seal',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56" fill="#d4af37"/><circle cx="60" cy="60" r="46" fill="none" stroke="#7a5c00" stroke-width="3" stroke-dasharray="4 3"/><text x="60" y="54" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="14" text-anchor="middle" fill="#3b2b00">SPECIAL</text><text x="60" y="74" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="14" text-anchor="middle" fill="#3b2b00">EDITION</text></svg>',
  },
  {
    label: 'Rating badge',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 100"><rect width="80" height="100" rx="6" fill="#111"/><rect x="4" y="4" width="72" height="92" rx="4" fill="none" stroke="#fff" stroke-width="2"/><text x="40" y="62" font-family="Helvetica,Arial,sans-serif" font-weight="700" font-size="48" text-anchor="middle" fill="#fff">T</text><text x="40" y="86" font-family="Helvetica,Arial,sans-serif" font-size="11" text-anchor="middle" fill="#fff">TEEN</text></svg>',
  },
  {
    label: 'Star rating',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 50"><g fill="#f5b301"><path id="s" d="M25 3l6.2 13.8 15 1.6-11.2 10 3.2 14.8L25 35.7 11.8 43.2 15 28.4 3.8 18.4l15-1.6z"/><use href="#s" x="50"/><use href="#s" x="100"/><use href="#s" x="150"/></g><path d="M225 3l6.2 13.8 15 1.6-11.2 10 3.2 14.8L225 35.7" fill="none" stroke="#f5b301" stroke-width="2"/></svg>',
  },
];
