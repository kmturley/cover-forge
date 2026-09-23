import type { MediaItem } from '../types/media';
import type { PanelId } from '../types/template';
import type { Design, PanelSettings, SharedSettings, SharedSpine } from '../types/editor';
import { PANEL_IDS } from './resolve';

export const DEFAULT_DESIGN_ID = 'default';
export const DEFAULT_DESIGN_NAME = 'Default';

const compact = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** `b` on top of `a`, field by field (the nested transform, logo and code merge too); unset fields in `b` leave `a` alone. */
export function mergePanelSettings(a: PanelSettings | undefined, b: PanelSettings | undefined): PanelSettings | undefined {
  if (!a) return b;
  if (!b) return a;
  const out: PanelSettings = { ...a, ...compact(b) };
  for (const k of ['transform', 'logo', 'code', 'border'] as const) {
    if (a[k] || b[k]) (out as Record<string, unknown>)[k] = { ...a[k], ...compact(b[k] ?? {}) };
  }
  return out;
}

/** The design an item uses, or undefined for Default (also when the id no longer exists). */
export const designOf = (designs: readonly Design[] | undefined, item: MediaItem | null): Design | undefined =>
  item?.designId ? designs?.find((d) => d.id === item.designId) : undefined;

/**
 * What an item gets before its own overrides: the Default design with its design on top.
 * Returns `shared` itself for Default, so callers can keep memoising on it.
 */
export function layeredShared(shared: SharedSettings, design: Design | undefined): SharedSettings {
  if (!design) return shared;
  const panels: SharedSettings['panels'] = { ...shared.panels };
  for (const id of PANEL_IDS) {
    const merged = mergePanelSettings(panels[id], design.panels[id]);
    if (merged) panels[id] = merged;
  }
  return { panels, spine: { ...shared.spine, ...compact(design.spine) } as SharedSpine };
}

/** The settings stored in a design itself (Default is `shared`), nothing inherited. */
export function designLayer(shared: SharedSettings, designs: readonly Design[], id: string): { panels: SharedSettings['panels']; spine: Partial<SharedSpine> } {
  return id === DEFAULT_DESIGN_ID ? shared : (designs.find((d) => d.id === id) ?? { panels: {}, spine: {} });
}

export function designHasPanel(shared: SharedSettings, designs: readonly Design[], id: string, panel: PanelId): boolean {
  const layer = designLayer(shared, designs, id);
  const p = layer.panels[panel];
  const hasPanel = !!p && Object.values(p).some((v) => v !== undefined);
  return hasPanel || ((panel === 'spine' || panel === 'spineRight') && id !== DEFAULT_DESIGN_ID && Object.keys(layer.spine).length > 0);
}

/** The items using a design. */
export const usersOf = (items: readonly MediaItem[], designs: readonly Design[], id: string): MediaItem[] =>
  items.filter((i) => (id === DEFAULT_DESIGN_ID ? !designOf(designs, i) : i.designId === id));
