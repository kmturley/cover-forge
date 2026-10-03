import type { MediaItem } from '../types/media';
import type { PanelId, TemplateKind } from '../types/template';
import { DEFAULT_BORDER, DEFAULT_CODE, DEFAULT_LOGO, DEFAULT_TRANSFORM, type BorderSettings, type CodeSettings, type ImageRef, type LogoSettings, type PanelBox, type PanelTransform, type SharedSettings, type SpineSettings } from '../types/editor';
import { defaultImageRef, resolveImageRef } from './imageLibrary';
import { LEGACY_FIELDS, isBox, overlayPlacement } from './box';

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

/** Formats whose back carries no barcode unless the user adds one: a tape, a floppy and every NFC piece. */
const NO_BACK_BARCODE: TemplateKind[] = ['cassette', 'floppy', 'nfc-card', 'nfc-sticker', 'nfc-box'];

/** The code a panel starts with when nobody has chosen one: an EAN-13 barcode on the back of every case but the formats above. */
export function defaultCodeKind(kind: TemplateKind | null | undefined, id: PanelId): CodeSettings['kind'] {
  return kind && id === 'back' && !NO_BACK_BARCODE.includes(kind) ? 'ean13' : DEFAULT_CODE.kind;
}

/**
 * Default → design → item for one of a panel's placed layers. A box that isn't a valid one (a corrupt or hand-edited
 * save) is treated as automatic. `box` is undefined only when the placement comes from an older save's mm fields.
 */
function layered<T extends { box?: PanelBox | null }>(base: T, shared: Partial<T> | undefined, own: Partial<T> | undefined, legacy: readonly string[]): T {
  const out = overlayPlacement(overlayPlacement(base, shared, legacy), own, legacy);
  if (out.box !== undefined && out.box !== null && !isBox(out.box)) out.box = null;
  return out;
}

/**
 * Effective settings for one panel, layered field by field: built-in default → shared → item override.
 * If a shared image choice (e.g. "logo" or "screenshot:3") doesn't exist on this item, the panel's default is used.
 * `templateKind` decides the default code (see defaultCodeKind); it is required so every caller resolves the same
 * code as the renderer. `null` only when no template applies (the code then defaults to none).
 */
export function resolvePanel(shared: SharedSettings, item: MediaItem | null, id: PanelId, templateKind: TemplateKind | null): ResolvedPanel {
  const s = shared.panels[id];
  const o = item?.panels?.[id];

  const chosen = o?.image !== undefined ? o.image : s?.image; // undefined = nothing chosen at either layer
  let imageRef = chosen === undefined ? defaultImageRef(id, item) : chosen;
  let imageUrl = item && imageRef ? resolveImageRef(item, imageRef) : null;
  if (item && imageRef && !imageUrl && chosen !== undefined) {
    imageRef = defaultImageRef(id, item);
    imageUrl = imageRef ? resolveImageRef(item, imageRef) : null;
  }

  return {
    backgroundColor: o?.backgroundColor ?? s?.backgroundColor ?? null,
    imageRef,
    imageUrl,
    // Placement is taken whole from the top layer that sets it (see overlayPlacement).
    transform: layered(DEFAULT_TRANSFORM, s?.transform, o?.transform, LEGACY_FIELDS.transform),
    logo: layered(DEFAULT_LOGO, s?.logo, o?.logo, LEGACY_FIELDS.logo),
    // An explicit choice (even "none") at the design or item level wins over the format's default.
    code: layered({ ...DEFAULT_CODE, kind: defaultCodeKind(templateKind, id) }, s?.code, o?.code, LEGACY_FIELDS.code),
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
