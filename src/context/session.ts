import type { MediaItem } from '../types/media';
import type { Design, PanelSettings, SharedSettings, StyleOverlay } from '../types/editor';
import type { TemplateKind } from '../types/template';
import { DEFAULT_KIND, defaultVariantId, isTemplateKind, variantsFor } from '../templates';
import { entryFor, upgradeTemplateId, type LastTemplates } from '../templates/library';
import { migrateItem, sortItems } from './items';
import { syncTemplate } from './templateOf';
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
    /** The empty-queue / last-picked template. Absent in older saves, which had one template for everything: */
    templateId?: string;
    /** Legacy: that one template's kind and variant (older still: a Blu-ray `region` + `spineMm`). */
    templateKind?: TemplateKind;
    variantId?: string;
    /** Legacy (Blu-ray only): 'US' or 'EU'. Only US cases are supported now. */
    region?: string;
    spineMm?: number;
    lastTemplates?: LastTemplates;
    banner?: boolean;
    /** Legacy: 'digital' meant with the banner. */
    styleOverlay?: StyleOverlay;
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
      templateId: s.templateId,
      lastTemplates: s.lastTemplates,
      banner: s.banner,
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

/** The one template a save from before per-item templates used, from its kind and variant (or Blu-ray region + spine). */
function legacyTemplateId(o: Record<string, unknown>): string {
  const region = o.region === 'EU' ? 'eu' : 'us';
  // Saves from before other templates existed have no kind and were Blu-ray; an unrecognised kind gets today's default.
  const kind: TemplateKind = isTemplateKind(o.templateKind) ? o.templateKind : o.templateKind === undefined ? 'bluray' : DEFAULT_KIND;
  // Older saves only knew Blu-ray and stored the spine width; map it onto today's variant ids.
  const legacyVariant = typeof o.spineMm === 'number' ? `${region}-${o.spineMm}` : undefined;
  const wanted = typeof o.variantId === 'string' ? o.variantId : legacyVariant;
  return upgradeTemplateId(`${kind}-${wanted}`) ?? entryFor(kind, variantsFor(kind).some((v) => v.id === wanted) ? (wanted as string) : defaultVariantId(kind)).id;
}

function restoreLastTemplates(raw: unknown): LastTemplates {
  if (!isObj(raw)) return {};
  return Object.fromEntries(Object.entries(raw).flatMap(([k, v]) => (MEDIA_TYPES.includes(k as MediaType) && upgradeTemplateId(v) ? [[k, upgradeTemplateId(v)]] : [])));
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

  const legacy = !('templateId' in o);
  const templateId = upgradeTemplateId(o.templateId) ?? legacyTemplateId(o);
  const restored = raw.version === 2 ? restoreDesigns(raw.designs, defaults.shared) : [];
  const migrated = restored.length === 0 ? migrateScopes(raw.scopes, items, defaults.shared) : { designs: [], items };
  const designs = [...restored, ...migrated.designs];
  // An item can only use a design that exists.
  // Before items had their own template every item used the session's one.
  const finalItems = migrated.items.map((i) => (i.designId && !designs.some((d) => d.id === i.designId) ? withoutDesign(i) : i)).map((i) => ({ ...i, templateId: upgradeTemplateId(i.templateId) ?? templateId }));
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

  return syncTemplate({
    ...defaults,
    items: finalItems,
    selectedItemId: selected ? (raw.selectedItemId as string) : (finalItems[0]?.id ?? null),
    templateId,
    // In a save from before per-item templates, new items kept getting its one template; they still do.
    lastTemplates: legacy ? Object.fromEntries([...new Set(finalItems.map((i) => i.type))].map((t) => [t, templateId])) : restoreLastTemplates(o.lastTemplates),
    template: defaults.template,
    selectedPanel: defaults.selectedPanel,
    banner: typeof o.banner === 'boolean' ? o.banner : o.styleOverlay === undefined ? defaults.banner : o.styleOverlay === 'digital',
    view: o.view === '2d' || o.view === '3d' ? o.view : defaults.view,
    shared,
    designs,
  });
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
