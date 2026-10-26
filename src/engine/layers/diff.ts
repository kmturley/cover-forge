import type { Layer, LayerDiff, LayerPatch, LegacyMm } from '../../types/layers';

/** Fields whose value is itself an object that merges field by field, so a patch can change one of its parts. */
const NESTED = ['stroke', 'params', 'textStroke', 'shadow'] as const;

const isLegacy = (v: unknown): v is LegacyMm => !!v && typeof v === 'object' && (v as { kind?: unknown }).kind === 'legacy';

/** `layer` with `patch` on top, field by field. Undefined fields in the patch are unset. */
export function applyPatch<L extends Layer>(layer: L, patch: LayerPatch): L {
  const out: Record<string, unknown> = { ...layer };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if ((NESTED as readonly string[]).includes(k) && v && typeof v === 'object') {
      out[k] = { ...(out[k] as object), ...Object.fromEntries(Object.entries(v).filter(([, f]) => f !== undefined)) };
    } else if (k === 'placement' && isLegacy(v) && isLegacy(out[k])) {
      // Older mm placements always merged field by field across layers, so saves from before boxes render as they did.
      out[k] = { ...out[k], ...Object.fromEntries(Object.entries(v).filter(([, f]) => f !== undefined)) };
    } else {
      out[k] = v;
    }
  }
  return out as unknown as L;
}

/**
 * The layers after a design's or an item's changes: patched fields, added layers, removed ones, then the order. A
 * change to a layer that isn't there (a diff made on another case) is ignored, so a design works on any case.
 */
export function applyDiff(layers: readonly Layer[], diff: LayerDiff | undefined): Layer[] {
  if (!diff) return layers as Layer[];
  let out = layers.map((l) => (diff.patch?.[l.id] ? applyPatch(l, diff.patch[l.id]) : l));
  // Added layers go in before layers are taken away, so one placed above a layer that is now hidden stays where it was put.
  for (const { layer, after } of diff.added ?? []) {
    const at = after === undefined ? -1 : out.findIndex((l) => l.id === after);
    out = at === -1 ? [...out, layer] : [...out.slice(0, at + 1), layer, ...out.slice(at + 1)];
  }
  const hidden = new Set(diff.hidden);
  out = out.filter((l) => !hidden.has(l.id));
  if (diff.order) {
    const rank = new Map(diff.order.map((id, i) => [id, i]));
    const named = out.filter((l) => rank.has(l.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    let n = 0;
    // The named layers fill the slots the named layers occupied, in the new order; everything else stays where it was.
    out = out.map((l) => (rank.has(l.id) ? named[n++] : l));
  }
  return out;
}
