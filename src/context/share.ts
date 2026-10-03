import type { MediaItem } from '../types/media';
import { isLocalRef } from '../storage/localImages';
import type { AppState } from './AppContext';
import { buildAssetUrls } from '../api/steam';
import { serializeSession } from './session';
import { defaultVariantId, isTemplateKind } from '../templates';
import { entryFor, upgradeTemplateId } from '../templates/library';
import { syncTemplate, templateIdOf } from './templateOf';

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
  const oneTemplate = state.items.every((i) => templateIdOf(state, i) === state.templateId);
  if (state.designs.length > 0 || !oneTemplate || !state.items.every(untouched) || Object.keys(state.shared.panels).length > 0 || Object.keys(state.shared.spine).some((k) => k !== 'fontFamily' && k !== 'color')) return null;
  // The last app id is the one selected when the link opens.
  const ids = [...state.items].sort((a, b) => Number(a.id === state.selectedItemId) - Number(b.id === state.selectedItemId)).map((i) => i.sourceId);
  const q = new URLSearchParams({ template: state.templateId, banner: state.banner ? '1' : '0', view: state.view });
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
  /** A library template id. Older links named a kind (`template=bluray`) plus a `variant` (and a `region`, now ignored). */
  template?: string;
  banner?: boolean;
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
  const style = q.get('style'); // legacy: clean | digital (with the banner) | retro
  const banner = q.get('banner');
  const view = q.get('view');
  const apps = [...(q.get('app') ?? '').split(','), ...q.getAll('appid')].map((v) => Number(v.trim())).filter((n) => Number.isInteger(n) && n > 0);
  return {
    template: upgradeTemplateId(template) ?? (isTemplateKind(template) ? entryFor(template, q.get('variant') ?? defaultVariantId(template)).id : undefined),
    banner: banner === '1' || banner === '0' ? banner === '1' : style === 'digital' ? true : style === 'clean' || style === 'retro' ? false : undefined,
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

/**
 * Applies plain parameters on top of a state. A template becomes the one for an empty queue; the link's games are
 * added with it too (see App), whatever cases the user normally prints for.
 */
export function applyParams(state: AppState, p: UrlParams): AppState {
  return syncTemplate({
    ...state,
    templateId: p.template ?? state.templateId,
    banner: p.banner ?? state.banner,
    view: p.view ?? state.view,
  });
}
