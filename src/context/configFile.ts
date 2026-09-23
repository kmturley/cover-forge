import { saveAs } from 'file-saver';
import type { MediaItem } from '../types/media';
import { isLocalRef, saveLocalImage, srcOf } from '../storage/localImages';
import { serializeSession, type SessionV2 } from './session';
import type { AppState } from './AppContext';

const readAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

/** Applies `f` to every image slot of every item. */
async function mapAssets(items: MediaItem[], f: (url: string) => Promise<string>): Promise<MediaItem[]> {
  const cache = new Map<string, Promise<string>>();
  const one = (u: string | null): Promise<string | null> => (u ? (cache.get(u) ?? cache.set(u, f(u)).get(u)!) : Promise.resolve(null));
  return Promise.all(
    items.map(async (i) => ({
      ...i,
      assets: {
        cover: await one(i.assets.cover),
        hero: await one(i.assets.hero),
        logo: await one(i.assets.logo),
        screenshots: (await Promise.all(i.assets.screenshots.map(one))).filter((u): u is string => !!u),
      },
    })),
  );
}

/** The config as a self-contained document: uploaded images (which live in this browser) are embedded. */
export async function portableSession(state: AppState): Promise<SessionV2> {
  const session = serializeSession(state);
  session.items = await mapAssets(session.items, async (url) => {
    const src = isLocalRef(url) ? srcOf(url) : undefined;
    if (!isLocalRef(url)) return url;
    if (!src) return url;
    try {
      return await readAsDataUrl(await (await fetch(src)).blob());
    } catch {
      return url;
    }
  });
  return session;
}

/** Moves embedded images back into browser storage (no scaling), so a loaded config doesn't bloat localStorage. */
export async function adoptImages(raw: unknown): Promise<unknown> {
  const s = raw as { items?: MediaItem[] };
  if (!s || !Array.isArray(s.items)) return raw;
  const items = await mapAssets(s.items.filter((i) => i && i.assets && Array.isArray(i.assets.screenshots)), async (url) => {
    if (!url.startsWith('data:image/')) return url;
    try {
      return (await saveLocalImage(await (await fetch(url)).blob())) ?? url;
    } catch {
      return url;
    }
  });
  return { ...s, items };
}

export const CONFIG_EXTENSION = '.coverforge.json';

interface SavePicker {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{ createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }>;
}

const DEFAULT_NAME = `coverforge-config${CONFIG_EXTENSION}`;

/**
 * Saves the config. Browsers with the File System Access API (Chrome, Edge) open a native "Save as" dialog so the
 * file goes where you choose; others download it to the usual folder. Returns false if the dialog was cancelled.
 */
export async function saveConfigFile(state: AppState): Promise<boolean> {
  const blob = new Blob([JSON.stringify(await portableSession(state))], { type: 'application/json' });
  const picker = (window as unknown as SavePicker).showSaveFilePicker;
  if (!picker) {
    saveAs(blob, DEFAULT_NAME);
    return true;
  }
  try {
    const handle = await picker.call(window, { suggestedName: DEFAULT_NAME, types: [{ description: 'CoverForge configuration', accept: { 'application/json': [CONFIG_EXTENSION, '.json'] } }] });
    const out = await handle.createWritable();
    await out.write(blob);
    await out.close();
    return true;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return false;
    saveAs(blob, DEFAULT_NAME); // the dialog was blocked (e.g. inside an iframe): fall back to a download
    return true;
  }
}

/** Reads a saved config. Throws a readable Error when the file isn't one. */
export async function readConfigFile(file: File): Promise<unknown> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error(`“${file.name}” isn't a CoverForge config (not valid JSON).`);
  }
  if (!raw || typeof raw !== 'object' || (raw as { app?: unknown }).app !== 'coverforge') throw new Error(`“${file.name}” isn't a CoverForge config.`);
  return adoptImages(raw);
}
