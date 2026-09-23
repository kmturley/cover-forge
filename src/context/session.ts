import type { MediaItem } from '../types/media';
import type { Region } from '../types/template';
import type { Design, PanelSettings, SharedSettings, StyleOverlay } from '../types/editor';
import type { TemplateKind } from '../types/template';
import { DEFAULT_KIND, buildTemplate, defaultVariantId, isTemplateKind, variantsFor } from '../templates';
import { migrateItem, sortItems } from './items';
import { TEMPLATE_DEFS } from '../templates';
import { PANEL_IDS } from '../engine/resolve';
import type { MediaType } from '../types/media';
import type { AppState, ViewMode } from './AppContext';

/**
 * Portable JSON form of a working session: the media queue, every option and the shared settings.
 * Used for localStorage restore today; the same document can back file save/load later.
 * Bump `version` (and add a migration in restoreSession) on any breaking change.
 */
export interface SessionV2 {
  app: 'coverforge';
  version: 2;
  items: MediaItem[];
  selectedItemId: string | null;
  options: {
    /** Absent in older saves, which stored a Blu-ray `region` + `spineMm` instead. */
    templateKind?: TemplateKind;
    variantId?: string;
    region: Region;
    /** Legacy (Blu-ray only); still read when `variantId` is missing. */
    spineMm?: number;
    styleOverlay: StyleOverlay;
    view: ViewMode;
  };
  /** Applies to every item; items may override any field via their own `panels` / `spineOverride`. */
  shared: SharedSettings;
  /** Named designs on top of the Default one (`shared`); items refer to them by `designId`. */
  designs?: Design[];
  /** Superseded by `designs`: per media type / template rules from an earlier version, converted on load. */
  scopes?: unknown;
}

export const STORAGE_KEY = 'coverforge:session';

export function serializeSession(s: AppState): SessionV2 {
  return {
    app: 'coverforge',
    version: 2,
    items: s.items,
    selectedItemId: s.selectedItemId,
    options: {
      templateKind: s.templateKind,
      variantId: s.variantId,
      region: s.region,
      styleOverlay: s.styleOverlay,
      view: s.view,
    },
    shared: s.shared,
    ...(s.designs.length > 0 && { designs: s.designs }),
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isItem = (v: unknown): v is MediaItem =>
  isObj(v) && typeof v.id === 'string' && typeof v.title === 'string' && isObj(v.assets) && Array.isArray(v.assets.screenshots);


function restoreShared(raw: unknown, defaults: SharedSettings): SharedSettings {
  if (!isObj(raw)) return defaults;
  const panels: SharedSettings['panels'] = {};
  if (isObj(raw.panels)) {
    for (const id of PANEL_IDS) if (isObj(raw.panels[id])) panels[id] = raw.panels[id] as PanelSettings;
  }
  const spine = isObj(raw.spine) ? { ...defaults.spine, ...(raw.spine as Partial<SharedSettings['spine']>) } : defaults.spine;
  // Every earlier save stored the old fixed default of 4 mm; that now means "automatic", which fits the template.
  if (spine.textHeightMm === 4) delete spine.textHeightMm;
  return { panels, spine };
}

const MEDIA_TYPES: MediaType[] = ['game', 'movie', 'tv', 'music', 'custom'];

function withoutDesign(item: MediaItem): MediaItem {
  const rest = { ...item };
  delete rest.designId;
  return rest;
}

const templateName = (k: TemplateKind) => TEMPLATE_DEFS.find((d) => d.kind === k)?.name ?? k;

/** Keeps the well-formed designs of a saved session and drops the rest. */
function restoreDesigns(raw: unknown, defaults: SharedSettings): Design[] {
  if (!Array.isArray(raw)) return [];
  const out: Design[] = [];
  for (const d of raw) {
    if (!isObj(d) || typeof d.id !== 'string' || typeof d.name !== 'string' || d.id === 'default' || out.some((o) => o.id === d.id)) continue;
    const { panels } = restoreShared({ panels: d.panels }, defaults);
    out.push({ id: d.id, name: d.name, panels, spine: isObj(d.spine) ? (d.spine as Design['spine']) : {} });
  }
  return out;
}

/**
 * Version 2 saves from before designs had per media type (and template) rules. Each one that names a media type becomes
 * a design given to that type's items; a rule that named only a template can't be expressed and is dropped.
 */
function migrateScopes(raw: unknown, items: MediaItem[], defaults: SharedSettings): { designs: Design[]; items: MediaItem[] } {
  if (!Array.isArray(raw)) return { designs: [], items };
  const designs: Design[] = [];
  let next = items;
  raw.forEach((r, n) => {
    if (!isObj(r) || !MEDIA_TYPES.includes(r.type as MediaType)) return;
    const type = r.type as MediaType;
    const { panels } = restoreShared({ panels: r.panels }, defaults);
    const id = `design-${type}-${n}`;
    const label = { game: 'Games', movie: 'Movies', tv: 'TV Shows', music: 'Music', custom: 'Custom' }[type];
    designs.push({ id, name: isTemplateKind(r.template) ? `${label} · ${templateName(r.template)}` : label, panels, spine: isObj(r.spine) ? (r.spine as Design['spine']) : {} });
    next = next.map((i) => (i.type === type && !i.designId ? { ...i, designId: id } : i));
  });
  return { designs, items: next };
}

/**
 * Applies a parsed session on top of `defaults`, field by field. Anything missing or invalid falls back
 * to the default, so a corrupt or older document degrades gracefully instead of crashing the app.
 * Version 1 (no shared layer) is migrated: its global spine font/colour become the shared spine style.
 */
export function restoreSession(raw: unknown, defaults: AppState): AppState {
  if (!isObj(raw) || raw.app !== 'coverforge' || (raw.version !== 1 && raw.version !== 2)) return defaults;
  const o = isObj(raw.options) ? raw.options : {};
  const items = Array.isArray(raw.items) ? sortItems(raw.items.filter(isItem).map(migrateItem)) : [];

  const region: Region = o.region === 'US' || o.region === 'EU' ? o.region : defaults.region;
  // Saves from before other templates existed have no kind and were Blu-ray; an unrecognised kind gets today's default.
  const kind: TemplateKind = isTemplateKind(o.templateKind) ? o.templateKind : o.templateKind === undefined ? 'bluray' : DEFAULT_KIND;
  // Older saves only knew Blu-ray and stored the spine width; map it onto today's variant ids.
  const legacyVariant = typeof o.spineMm === 'number' ? `${region.toLowerCase()}-${o.spineMm}` : undefined;
  const wanted = typeof o.variantId === 'string' ? o.variantId : legacyVariant;
  const variantId = variantsFor(kind, region).some((v) => v.id === wanted) ? (wanted as string) : defaultVariantId(kind, region);
  const restored = raw.version === 2 ? restoreDesigns(raw.designs, defaults.shared) : [];
  const migrated = restored.length === 0 ? migrateScopes(raw.scopes, items, defaults.shared) : { designs: [], items };
  const designs = [...restored, ...migrated.designs];
  // An item can only use a design that exists.
  const finalItems = migrated.items.map((i) => (i.designId && !designs.some((d) => d.id === i.designId) ? withoutDesign(i) : i));
  const selected = typeof raw.selectedItemId === 'string' && finalItems.some((i) => i.id === raw.selectedItemId);

  let shared = defaults.shared;
  if (raw.version === 2) {
    shared = restoreShared(raw.shared, defaults.shared);
  } else if (isObj(o.spine)) {
    // v1 stored the old default text height too; keep only font and colour so the new default applies.
    const { fontFamily, color } = o.spine;
    shared = {
      ...defaults.shared,
      spine: {
        ...defaults.shared.spine,
        ...(typeof fontFamily === 'string' && { fontFamily }),
        ...(typeof color === 'string' && { color }),
      },
    };
  }

  return {
    ...defaults,
    items: finalItems,
    selectedItemId: selected ? (raw.selectedItemId as string) : (finalItems[0]?.id ?? null),
    templateKind: kind,
    region,
    variantId,
    template: buildTemplate(kind, variantId),
    selectedPanel: defaults.selectedPanel,
    styleOverlay: o.styleOverlay === 'clean' || o.styleOverlay === 'digital' || o.styleOverlay === 'retro' ? o.styleOverlay : defaults.styleOverlay,
    view: o.view === '2d' || o.view === '3d' ? o.view : defaults.view,
    shared,
    designs,
  };
}

/** Storage can be missing, full or blocked (private windows), so every access is guarded. */
export function loadSession(defaults: AppState): AppState {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? restoreSession(JSON.parse(text), defaults) : defaults;
  } catch {
    return defaults;
  }
}

/** Returns false when the browser refused the write (quota exceeded, storage blocked) so the UI can say so. */
export function saveSession(state: AppState): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializeSession(state)));
    return true;
  } catch {
    return false;
  }
}
