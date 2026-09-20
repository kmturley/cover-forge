import type { MediaItem } from '../types/media';
import type { Region, TemplateKind } from '../types/template';
import type { StyleOverlay } from '../types/editor';
import { isLocalRef } from '../storage/localImages';
import type { AppState } from './AppContext';
import { buildAssetUrls } from '../api/steam';
import { serializeSession } from './session';
import { buildTemplate, defaultVariantId, isTemplateKind, variantsFor } from '../templates';

/** Beyond this a link may be refused by servers, chat apps or older browsers; the UI suggests saving a file instead. */
export const MAX_SHARE_URL = 6000;

const toBase64Url = (bytes: Uint8Array): string => {
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (text: string): Uint8Array => {
  const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** JSON → deflate → URL-safe base64. */
export async function encodeConfig(value: unknown): Promise<string> {
  return toBase64Url(await pipe(new TextEncoder().encode(JSON.stringify(value)), new CompressionStream('deflate-raw')));
}

/** The reverse of encodeConfig; null when the text isn't a valid encoded config. */
export async function decodeConfig(text: string): Promise<unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'))));
  } catch {
    return null;
  }
}

/** Images that only exist in this browser can't travel in a link, so those slots are emptied. */
function withoutLocalImages(item: MediaItem): { item: MediaItem; dropped: number } {
  let dropped = 0;
  const one = (u: string | null) => (isLocalRef(u) ? (dropped++, null) : u);
  const a = item.assets;
  const assets = { cover: one(a.cover), hero: one(a.hero), logo: one(a.logo), screenshots: a.screenshots.filter((u) => !isLocalRef(u) || (dropped++, false)) };
  return { item: { ...item, assets }, dropped };
}

export interface ShareLink {
  url: string;
  /** Uploaded images left out of the link (they only exist in this browser). */
  droppedImages: number;
  tooLong: boolean;
}

/**
 * A readable link (`?template=dvd&variant=…&app=1091500`) when it says everything: only untouched Steam games,
 * default panel settings and no overrides. Anything else needs the packed form. Null when it doesn't fit.
 */
export function plainShareUrl(state: AppState, base: string): string | null {
  const untouched = (i: MediaItem) => /^steam-\d+$/.test(i.id) && !i.panels && !i.spineOverride && i.assets.cover === buildAssetUrls(Number(i.sourceId)).cover;
  if (!state.items.every(untouched) || Object.keys(state.shared.panels).length > 0 || Object.keys(state.shared.spine).some((k) => k !== 'fontFamily' && k !== 'color')) return null;
  // The last app id is the one selected when the link opens.
  const ids = [...state.items].sort((a, b) => Number(a.id === state.selectedItemId) - Number(b.id === state.selectedItemId)).map((i) => i.sourceId);
  const q = new URLSearchParams({ template: state.templateKind, variant: state.variantId, region: state.region, style: state.styleOverlay, view: state.view });
  if (ids.length) q.set('app', ids.join(','));
  return `${base.split(/[?#]/)[0]}?${q.toString().replace(/%2C/g, ',')}`;
}

/** A link that reopens this exact configuration: the queue, template, options and every panel setting. */
export async function buildShareLink(state: AppState, base: string): Promise<ShareLink> {
  const plain = plainShareUrl(state, base);
  if (plain) return { url: plain, droppedImages: 0, tooLong: plain.length > MAX_SHARE_URL };
  const session = serializeSession(state);
  let droppedImages = 0;
  session.items = session.items.map((i) => {
    const r = withoutLocalImages(i);
    droppedImages += r.dropped;
    return r.item;
  });
  const url = `${base.split(/[?#]/)[0]}?c=${await encodeConfig(session)}`;
  return { url, droppedImages, tooLong: url.length > MAX_SHARE_URL };
}

/** Plain, hand-writable link parameters. */
export interface UrlParams {
  template?: TemplateKind;
  variant?: string;
  region?: Region;
  style?: StyleOverlay;
  view?: '2d' | '3d';
  /** Steam app ids to add to the queue and select (the last one is selected). */
  apps: number[];
}

/** What a page load asked for: a full encoded config and/or simple parameters. */
export interface Startup {
  session?: unknown;
  params: UrlParams;
}

export function parseParams(search: string): UrlParams {
  const q = new URLSearchParams(search);
  const template = q.get('template');
  const region = q.get('region');
  const style = q.get('style');
  const view = q.get('view');
  const apps = [...(q.get('app') ?? '').split(','), ...q.getAll('appid')].map((v) => Number(v.trim())).filter((n) => Number.isInteger(n) && n > 0);
  return {
    template: isTemplateKind(template) ? template : undefined,
    variant: q.get('variant') ?? undefined,
    region: region === 'US' || region === 'EU' ? region : undefined,
    style: style === 'clean' || style === 'digital' || style === 'retro' ? style : undefined,
    view: view === '2d' || view === '3d' ? view : undefined,
    apps: [...new Set(apps)],
  };
}

/** Reads the page's link. Never throws: a broken link just opens the app as usual. */
export async function readStartup(search: string): Promise<Startup> {
  const q = new URLSearchParams(search);
  const c = q.get('c');
  return { session: c ? await decodeConfig(c) : undefined, params: parseParams(search) };
}

/** Applies plain parameters on top of a state (template first, then its size). */
export function applyParams(state: AppState, p: UrlParams): AppState {
  let s = state;
  if (p.template || p.region || p.variant) {
    const kind = p.template ?? s.templateKind;
    const region = p.region ?? s.region;
    const wanted = p.variant && variantsFor(kind, region).some((v) => v.id === p.variant) ? p.variant : undefined;
    const variantId = wanted ?? (p.template || p.region ? defaultVariantId(kind, region) : s.variantId);
    const template = buildTemplate(kind, variantId);
    const selectedPanel = template.panels.some((q) => q.id === s.selectedPanel) ? s.selectedPanel : template.panels[0].id;
    s = { ...s, templateKind: kind, region, variantId: template.variantId, template, selectedPanel };
  }
  return { ...s, styleOverlay: p.style ?? s.styleOverlay, view: p.view ?? s.view };
}
