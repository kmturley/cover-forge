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

export async function saveConfigFile(state: AppState): Promise<void> {
  const session = await portableSession(state);
  saveAs(new Blob([JSON.stringify(session)], { type: 'application/json' }), `coverforge-config${CONFIG_EXTENSION}`);
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
