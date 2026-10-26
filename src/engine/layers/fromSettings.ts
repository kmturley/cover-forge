import type { PanelId } from '../../types/template';
import type { PanelSettings, SpineSettings } from '../../types/editor';
import type { LayerDiff, LayerPatch, LayerPlacement, LegacyMm } from '../../types/layers';
import { PANEL_IDS } from '../resolve';
import { isBox } from '../box';
import { boxToPlacement } from './placement';

const defined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/**
 * The placement a slot's settings set, or `undefined` when they set none. A `box` (even `null`, "automatic") replaces
 * everything below it about where the thing sits and wins over any mm fields; mm fields alone are an older save's
 * placement. A box that isn't a valid one (a corrupt or hand-edited save) is automatic.
 */
function placementOf(own: { box?: unknown } & Record<string, unknown>, legacyKeys: readonly string[]): LayerPlacement | undefined {
  if ('box' in own && own.box !== undefined) return isBox(own.box) ? boxToPlacement(own.box) : null;
  const legacy = Object.fromEntries(legacyKeys.filter((k) => own[k] !== undefined).map((k) => [k, own[k]]));
  return Object.keys(legacy).length > 0 ? ({ kind: 'legacy', ...legacy } as LegacyMm) : undefined;
}

function panelPatches(id: PanelId, s: PanelSettings): Record<string, LayerPatch> {
  const out: Record<string, LayerPatch> = {};
  if (s.backgroundColor !== undefined) out[`${id}.fill`] = { fill: s.backgroundColor };

  const image: LayerPatch = {};
  if (s.image !== undefined) image.source = s.image === null ? null : { kind: 'role', ref: s.image };
  if (s.transform) {
    const t = defined(s.transform);
    const placement = placementOf(t as never, ['xMm', 'yMm', 'scale']);
    if (placement !== undefined) image.placement = placement;
    Object.assign(image, defined({ fit: t.fit, rotationDeg: t.rotationDeg, opacity: t.opacity }));
  }
  if (Object.keys(image).length > 0) out[`${id}.image`] = image;

  if (s.logo) {
    const l = defined(s.logo);
    const logo: LayerPatch = {};
    if (l.brand !== undefined) logo.source = l.brand === null ? null : { kind: 'vector', id: l.brand };
    const placement = placementOf(l as never, ['xMm', 'yMm', 'widthMm']);
    if (placement !== undefined) logo.placement = placement;
    Object.assign(logo, defined({ tint: l.color, rotationDeg: l.rotationDeg, opacity: l.opacity }));
    if (Object.keys(logo).length > 0) out[`${id}.logo`] = logo;
  }

  if (s.code) {
    const c = defined(s.code);
    const code: LayerPatch = {};
    const placement = placementOf(c as never, ['xMm', 'yMm', 'widthMm']);
    if (placement !== undefined) code.placement = placement;
    Object.assign(code, defined({ rotationDeg: c.rotationDeg, opacity: c.opacity }));
    const params = defined({ kind: c.kind, pattern: c.pattern, color: c.color, background: c.background });
    if (Object.keys(params).length > 0) code.params = params;
    if (Object.keys(code).length > 0) out[`${id}.code`] = code;
  }

  if (s.border) {
    const stroke = defined(s.border);
    if (Object.keys(stroke).length > 0) out[`${id}.border`] = { stroke };
  }
  return out;
}

/** Spine text settings are one set for the whole piece, so they patch every spine text layer a case has. */
function spinePatch(spine: Partial<SpineSettings> | undefined): LayerPatch {
  const s = defined(spine ?? {});
  return defined({ text: s.text, textTemplate: s.textTemplate, fontFamily: s.fontFamily, color: s.color, textHeightMm: s.textHeightMm, textRotationDeg: s.rotationDeg });
}

const cache = new WeakMap<object, WeakMap<object, LayerDiff>>();
const NONE = {};

/**
 * What a slot-style settings object (the Default design, a named design, or an item's overrides) changes about the
 * layers: each field becomes a patch on the layer with the matching id. This is how every older save maps onto layers.
 */
export function settingsToDiff(panels: Partial<Record<PanelId, PanelSettings>> | undefined, spine?: Partial<SpineSettings>): LayerDiff {
  const byPanels = cache.get(panels ?? NONE) ?? cache.set(panels ?? NONE, new WeakMap()).get(panels ?? NONE)!;
  const hit = byPanels.get(spine ?? NONE);
  if (hit) return hit;
  const patch: Record<string, LayerPatch> = {};
  for (const id of PANEL_IDS) {
    const s = panels?.[id];
    if (s) Object.assign(patch, panelPatches(id, s));
  }
  const text = spinePatch(spine);
  if (Object.keys(text).length > 0) for (const id of PANEL_IDS) patch[`${id}.text`] = text;
  const diff: LayerDiff = { patch };
  byPanels.set(spine ?? NONE, diff);
  return diff;
}
