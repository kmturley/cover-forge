/**
 * Uploaded images keep their original bytes: the file is stored as a Blob in IndexedDB (no scaling, no localStorage
 * quota) and referred to by a `local:<id>` URL. Browsers never expose a file's path, so this is the closest thing to
 * "refer to the original file" that survives a reload. `hydrateLocalImages()` must finish before the app renders so
 * `srcOf()` can stay synchronous.
 */
const DB = 'coverforge';
const STORE = 'images';
export const LOCAL_PREFIX = 'local:';

const objectUrls = new Map<string, string>();

export const isLocalRef = (url: string | null | undefined): url is string => !!url && url.startsWith(LOCAL_PREFIX);

/** The URL to give an <img>, fetch() or Image: local refs become object URLs; everything else passes through. */
export function srcOf(url: string): string;
export function srcOf(url: string | null | undefined): string | undefined;
export function srcOf(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return isLocalRef(url) ? objectUrls.get(url) : url;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

const request = <T,>(db: IDBDatabase, mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    const req = run(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

/** Loads every stored image into object URLs. Never throws: with no IndexedDB the app just has no local images. */
export async function hydrateLocalImages(): Promise<void> {
  try {
    const db = await open();
    const keys = (await request(db, 'readonly', (s) => s.getAllKeys())) as string[];
    const blobs = (await request(db, 'readonly', (s) => s.getAll())) as Blob[];
    keys.forEach((k, i) => objectUrls.set(k, URL.createObjectURL(blobs[i])));
    db.close();
  } catch {
    // storage unavailable (private window, blocked): local refs simply won't resolve
  }
}

/** Stores the file untouched. Returns its `local:` ref, or null if storage isn't available (caller falls back). */
export async function saveLocalImage(file: Blob): Promise<string | null> {
  try {
    const ref = `${LOCAL_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const db = await open();
    await request(db, 'readwrite', (s) => s.put(file, ref));
    db.close();
    objectUrls.set(ref, URL.createObjectURL(file));
    return ref;
  } catch {
    return null;
  }
}
