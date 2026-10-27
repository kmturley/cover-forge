import { saveAs } from 'file-saver';
import type { Design } from '../types/editor';
import type { Asset, Layer, LayerDiff } from '../types/layers';
import { adoptAssets, embedAssets } from '../storage/assets';
import { sanitizeAssets } from '../engine/layers/sanitize';
import { DEFAULTS_VERSION } from '../engine/layers/presets';
import { restoreDesignsFrom } from './session';

/**
 * A design on its own, as a file to share: its settings and layers, and the images its layers use (an upload's bytes
 * ride along). It is a diff over the default layers, which are a frozen public format, so it means the same anywhere;
 * `base` records which version it was made against.
 */
export interface DesignFile {
  app: 'coverforge-design';
  version: 1;
  name: string;
  base: number;
  panels: Design['panels'];
  spine: Design['spine'];
  diff?: LayerDiff;
  assets?: Asset[];
}

export const DESIGN_EXTENSION = '.coverforge-design.json';

/** The ids of assets a diff's layers (and patches to layers) use. */
export function assetIdsIn(diff: LayerDiff | undefined): Set<string> {
  const ids = new Set<string>();
  const look = (l: Pick<Layer, 'type'> & { source?: unknown }) => {
    const s = l.source as { kind?: string; id?: string } | null | undefined;
    if (s?.kind === 'asset' && s.id) ids.add(s.id);
  };
  for (const a of diff?.added ?? []) look(a.layer as never);
  for (const p of Object.values(diff?.patch ?? {})) look({ type: 'image', source: p.source });
  return ids;
}

/** The design as a file document, with the assets its layers use. */
export async function buildDesignFile(design: Design, assets: Record<string, Asset>): Promise<DesignFile> {
  const used = [...assetIdsIn(design.diff)].filter((id) => assets[id]);
  const embedded = await embedAssets(Object.fromEntries(used.map((id) => [id, assets[id]])));
  return {
    app: 'coverforge-design',
    version: 1,
    name: design.name,
    base: design.base ?? DEFAULTS_VERSION,
    panels: design.panels,
    spine: design.spine,
    ...(design.diff && { diff: design.diff }),
    ...(used.length > 0 && { assets: Object.values(embedded) }),
  };
}

/** Saves a design as a file. */
export async function saveDesignFile(design: Design, assets: Record<string, Asset>): Promise<void> {
  const file = await buildDesignFile(design, assets);
  const name = design.name.replace(/[^\w .-]+/g, '').trim() || 'design';
  saveAs(new Blob([JSON.stringify(file)], { type: 'application/json' }), `${name}${DESIGN_EXTENSION}`);
}

export interface ImportedDesign {
  design: Design;
  assets: Record<string, Asset>;
}

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

/** An id for a design that is added to the session. */
export const newDesignId = (): string => newId('design');

/** Rewrites asset references in a diff through `map`. */
function remapAssets(diff: LayerDiff | undefined, map: Map<string, string>): LayerDiff | undefined {
  if (!diff || map.size === 0) return diff;
  const swap = (s: unknown) => (s && typeof s === 'object' && (s as { kind?: string }).kind === 'asset' && map.has((s as { id: string }).id) ? { ...(s as object), id: map.get((s as { id: string }).id) } : s);
  return {
    ...diff,
    ...(diff.added && { added: diff.added.map((a) => ('source' in a.layer ? { ...a, layer: { ...a.layer, source: swap(a.layer.source) } as Layer } : a)) }),
    ...(diff.patch && { patch: Object.fromEntries(Object.entries(diff.patch).map(([id, p]) => [id, 'source' in p ? { ...p, source: swap(p.source) } : p])) }),
  };
}

/**
 * Reads a design file. Everything in it is validated like a saved session, the design gets an id of its own, and an
 * asset whose id is already used here for something else is given a new one (with the layers that use it following).
 * Throws a readable Error when the file isn't a design.
 */
export function parseDesignFile(raw: unknown, existing: Record<string, Asset>, fileName = 'the file'): ImportedDesign {
  const r = raw as Partial<DesignFile> | null;
  if (!r || typeof r !== 'object' || r.app !== 'coverforge-design') throw new Error(`“${fileName}” isn't a CoverForge design.`);
  const id = newId('design');
  const [design] = restoreDesignsFrom([{ id, name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 80) : 'Imported design', panels: r.panels, spine: r.spine, diff: r.diff, base: r.base }]);
  if (!design) throw new Error(`“${fileName}” doesn't hold a design that can be read.`);
  const incoming = sanitizeAssets(Array.isArray(r.assets) ? Object.fromEntries(r.assets.map((a) => [a?.id, a])) : {});
  const assets: Record<string, Asset> = {};
  const map = new Map<string, string>();
  for (const [aid, a] of Object.entries(incoming)) {
    const have = existing[aid];
    const same = have && JSON.stringify(have.source) === JSON.stringify(a.source);
    if (have && !same) {
      const fresh = newId('asset');
      map.set(aid, fresh);
      assets[fresh] = { ...a, id: fresh };
    } else if (!have) assets[aid] = a;
  }
  const diff = remapAssets(design.diff, map);
  return { design: { ...design, ...(diff ? { diff } : {}) }, assets };
}

/** Reads a design file from disk, moving any embedded images into browser storage. */
export async function readDesignFile(file: File, existing: Record<string, Asset>): Promise<ImportedDesign> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    throw new Error(`“${file.name}” isn't a CoverForge design (not valid JSON).`);
  }
  const imported = parseDesignFile(raw, existing, file.name);
  return { ...imported, assets: await adoptAssets(imported.assets) };
}
