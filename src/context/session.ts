import type { MediaItem } from '../types/media';
import type { Region } from '../types/template';
import type { PanelSettings, SharedSettings, StyleOverlay } from '../types/editor';
import type { PanelId, TemplateKind } from '../types/template';
import { DEFAULT_KIND, buildTemplate, defaultVariantId, isTemplateKind, variantsFor } from '../templates';
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
  };
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isItem = (v: unknown): v is MediaItem =>
  isObj(v) && typeof v.id === 'string' && typeof v.title === 'string' && isObj(v.assets) && Array.isArray(v.assets.screenshots);

const PANEL_IDS: PanelId[] = ['front', 'spine', 'spineRight', 'back', 'flap', 'top', 'bottom', 'glue', 'tuck'];

function restoreShared(raw: unknown, defaults: SharedSettings): SharedSettings {
  if (!isObj(raw)) return defaults;
  const panels: SharedSettings['panels'] = {};
  if (isObj(raw.panels)) {
    for (const id of PANEL_IDS) if (isObj(raw.panels[id])) panels[id] = raw.panels[id] as PanelSettings;
  }
  const spine = isObj(raw.spine) ? { ...defaults.spine, ...(raw.spine as Partial<SharedSettings['spine']>) } : defaults.spine;
  return { panels, spine };
}

/**
 * Applies a parsed session on top of `defaults`, field by field. Anything missing or invalid falls back
 * to the default, so a corrupt or older document degrades gracefully instead of crashing the app.
 * Version 1 (no shared layer) is migrated: its global spine font/colour become the shared spine style.
 */
export function restoreSession(raw: unknown, defaults: AppState): AppState {
  if (!isObj(raw) || raw.app !== 'coverforge' || (raw.version !== 1 && raw.version !== 2)) return defaults;
  const o = isObj(raw.options) ? raw.options : {};
  const items = Array.isArray(raw.items) ? raw.items.filter(isItem) : [];

  const region: Region = o.region === 'US' || o.region === 'EU' ? o.region : defaults.region;
  // Saves from before other templates existed have no kind and were Blu-ray; an unrecognised kind gets today's default.
  const kind: TemplateKind = isTemplateKind(o.templateKind) ? o.templateKind : o.templateKind === undefined ? 'bluray' : DEFAULT_KIND;
  // Older saves only knew Blu-ray and stored the spine width; map it onto today's variant ids.
  const legacyVariant = typeof o.spineMm === 'number' ? `${region.toLowerCase()}-${o.spineMm}` : undefined;
  const wanted = typeof o.variantId === 'string' ? o.variantId : legacyVariant;
  const variantId = variantsFor(kind, region).some((v) => v.id === wanted) ? (wanted as string) : defaultVariantId(kind, region);
  const selected = typeof raw.selectedItemId === 'string' && items.some((i) => i.id === raw.selectedItemId);

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
    items,
    selectedItemId: selected ? (raw.selectedItemId as string) : (items[0]?.id ?? null),
    templateKind: kind,
    region,
    variantId,
    template: buildTemplate(kind, variantId),
    selectedPanel: defaults.selectedPanel,
    styleOverlay: o.styleOverlay === 'clean' || o.styleOverlay === 'digital' || o.styleOverlay === 'retro' ? o.styleOverlay : defaults.styleOverlay,
    view: o.view === '2d' || o.view === '3d' ? o.view : defaults.view,
    shared,
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
