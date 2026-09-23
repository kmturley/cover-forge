import type { MediaItem } from '../types/media';
import type { PanelId } from '../types/template';
import { DEFAULT_BORDER, DEFAULT_CODE, DEFAULT_LOGO, DEFAULT_TRANSFORM, type BorderSettings, type CodeSettings, type ImageRef, type LogoSettings, type PanelTransform, type SharedSettings, type SpineSettings } from '../types/editor';
import { defaultImageRef, resolveImageRef } from './imageLibrary';

/** Fills the whole canvas before any panel is painted. */
export const BASE_BACKGROUND = '#111111';

/** Every panel id any template uses; used to scan settings regardless of the active template. */
export const PANEL_IDS: PanelId[] = ['front', 'spine', 'spineRight', 'back', 'flap', 'top', 'bottom', 'glue', 'tuck', 'bottomTuck'];

export interface ResolvedPanel {
  /** null = no panel colour; the base background shows through. */
  backgroundColor: string | null;
  imageRef: ImageRef | null;
  imageUrl: string | null;
  transform: PanelTransform;
  logo: LogoSettings;
  code: CodeSettings;
  border: BorderSettings;
}

/**
 * Effective settings for one panel, layered field by field: built-in default → shared → item override.
 * If a shared image choice (e.g. "logo" or "screenshot:3") doesn't exist on this item, the panel's default is used.
 */
export function resolvePanel(shared: SharedSettings, item: MediaItem | null, id: PanelId): ResolvedPanel {
  const s = shared.panels[id];
  const o = item?.panels?.[id];

  const chosen = o?.image !== undefined ? o.image : s?.image; // undefined = nothing chosen at either layer
  let imageRef = chosen === undefined ? defaultImageRef(id) : chosen;
  let imageUrl = item && imageRef ? resolveImageRef(item, imageRef) : null;
  if (item && imageRef && !imageUrl && chosen !== undefined) {
    imageRef = defaultImageRef(id);
    imageUrl = imageRef ? resolveImageRef(item, imageRef) : null;
  }

  return {
    backgroundColor: o?.backgroundColor ?? s?.backgroundColor ?? null,
    imageRef,
    imageUrl,
    transform: { ...DEFAULT_TRANSFORM, ...s?.transform, ...o?.transform },
    logo: { ...DEFAULT_LOGO, ...s?.logo, ...o?.logo },
    code: { ...DEFAULT_CODE, ...s?.code, ...o?.code },
    border: { ...DEFAULT_BORDER, ...s?.border, ...o?.border },
  };
}

export function resolveSpine(shared: SharedSettings, item: MediaItem | null): SpineSettings {
  return { ...shared.spine, ...item?.spineOverride };
}

/** True if the item overrides anything on this panel (the spine tab also covers its text styling). */
export function panelHasOverride(item: MediaItem | null, id: PanelId): boolean {
  const p = item?.panels?.[id];
  const hasPanel = !!p && Object.values(p).some((v) => v !== undefined);
  const hasSpine = (id === 'spine' || id === 'spineRight') && !!item?.spineOverride && Object.keys(item.spineOverride).length > 0;
  return hasPanel || hasSpine;
}

export function itemHasOverrides(item: MediaItem | null): boolean {
  return PANEL_IDS.some((id) => panelHasOverride(item, id));
}
