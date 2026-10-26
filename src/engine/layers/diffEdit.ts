import type { PanelId } from '../../types/template';
import type { Layer, LayerDiff, LayerPatch } from '../../types/layers';
import { applyPatch } from './diff';

/** Fields that merge field by field when a patch changes them (see applyPatch). */
const NESTED = ['stroke', 'params', 'textStroke', 'shadow'] as const;

/** A stored patch with `change` on top. A field set to `undefined` is dropped, so the layer inherits it again. */
export function mergePatch(stored: LayerPatch | undefined, change: LayerPatch): LayerPatch {
  const out: LayerPatch = { ...stored };
  for (const [k, v] of Object.entries(change)) {
    if (v === undefined) delete out[k];
    else if ((NESTED as readonly string[]).includes(k) && v && typeof v === 'object') {
      const merged = Object.fromEntries(Object.entries({ ...(out[k] as object), ...v }).filter(([, f]) => f !== undefined));
      if (Object.keys(merged).length > 0) out[k] = merged;
      else delete out[k];
    } else if (k === 'placement' && v && typeof v === 'object' && 'kind' in v && out[k] && typeof out[k] === 'object' && 'kind' in (out[k] as object)) {
      out[k] = { ...(out[k] as object), ...Object.fromEntries(Object.entries(v).filter(([, f]) => f !== undefined)) };
    } else out[k] = v;
  }
  return out;
}

const tidy = (d: LayerDiff): LayerDiff => {
  const out: LayerDiff = { ...d };
  for (const k of ['patch', 'hidden', 'added', 'order'] as const) {
    const v = out[k];
    if (v === undefined || (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0)) delete out[k];
  }
  return out;
};

const isAdded = (d: LayerDiff, id: string) => d.added?.some((a) => a.layer.id === id) ?? false;

/** Adds a layer above `after` (or on top). */
export function diffAdd(d: LayerDiff, layer: Layer, after?: string): LayerDiff {
  return tidy({ ...d, added: [...(d.added ?? []).filter((a) => a.layer.id !== layer.id), { layer, ...(after !== undefined && { after }) }], hidden: d.hidden?.filter((h) => h !== layer.id) });
}

/** Changes a layer: one the diff added is changed in place, anything else gets a patch. */
export function diffUpdate(d: LayerDiff, id: string, change: LayerPatch): LayerDiff {
  if (isAdded(d, id)) return { ...d, added: d.added!.map((a) => (a.layer.id === id ? { ...a, layer: applyPatch(a.layer, change) } : a)) };
  return tidy({ ...d, patch: { ...d.patch, [id]: mergePatch(d.patch?.[id], change) } });
}

/** Takes a layer away: a layer the diff added is dropped, a layer from below is hidden (so it can come back). */
export function diffRemove(d: LayerDiff, id: string): LayerDiff {
  const patch = { ...d.patch };
  delete patch[id];
  const order = d.order?.filter((o) => o !== id);
  if (isAdded(d, id)) return tidy({ ...d, added: d.added!.filter((a) => a.layer.id !== id), patch, order });
  return tidy({ ...d, hidden: [...new Set([...(d.hidden ?? []), id])], patch, order });
}

/** Brings a hidden layer back, and drops its patches: it looks as it does lower down. */
export function diffReset(d: LayerDiff, id: string): LayerDiff {
  const patch = { ...d.patch };
  delete patch[id];
  return tidy({ ...d, hidden: d.hidden?.filter((h) => h !== id), patch });
}

export const diffOrder = (d: LayerDiff, order: string[]): LayerDiff => tidy({ ...d, order });

/** True when the diff changes anything about layers on `panel`. Default layers are named `<panel>.<slot>`. */
export function diffTouchesPanel(d: LayerDiff | undefined, panel: PanelId | 'canvas'): boolean {
  if (!d) return false;
  const own = (id: string) => id.startsWith(`${panel}.`);
  return !!d.added?.some((a) => a.layer.target === panel) || Object.keys(d.patch ?? {}).some(own) || !!d.hidden?.some(own);
}

/** The diff without anything about layers on `panel` (an added layer's patches and place in the order go with it). */
export function diffWithoutPanel(d: LayerDiff | undefined, panel: PanelId | 'canvas'): LayerDiff {
  if (!d) return {};
  const gone = new Set((d.added ?? []).filter((a) => a.layer.target === panel).map((a) => a.layer.id));
  const own = (id: string) => id.startsWith(`${panel}.`) || gone.has(id);
  return tidy({
    ...d,
    patch: Object.fromEntries(Object.entries(d.patch ?? {}).filter(([id]) => !own(id))),
    hidden: d.hidden?.filter((id) => !own(id)),
    added: d.added?.filter((a) => !gone.has(a.layer.id)),
    order: d.order?.filter((id) => !gone.has(id)),
  });
}
