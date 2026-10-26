import type { Axis, Layer, LayerDiff, LayerPatch, LayerPlacement, ImageSource, Asset } from '../../types/layers';
import type { CodeKind } from '../../types/editor';
import { PANEL_IDS } from '../resolve';
import { newCode, newImage, newShape, newText } from './factory';

/**
 * Layers come from saves and share links, so nothing in them is trusted. Every field is checked against what drawing
 * expects, and anything wrong is dropped (a patch) or replaced by the type's default (a layer), so a corrupt or
 * hand-edited document degrades instead of throwing in the renderer.
 */
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e6 ? v : undefined);
const str = (v: unknown, max = 500): string | undefined => (typeof v === 'string' && v.length <= max ? v : undefined);
const bool = (v: unknown): boolean | undefined => (typeof v === 'boolean' ? v : undefined);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): T | undefined => (list.includes(v as T) ? (v as T) : undefined);

const TARGETS = [...PANEL_IDS, 'dustTopLeft', 'dustTopRight', 'dustBottomLeft', 'dustBottomRight'] as const;
const CODE_KINDS: readonly CodeKind[] = ['none', 'qr', 'ean13', 'upca', 'code128'];

function axis(v: unknown): Axis | undefined {
  if (!isObj(v)) return undefined;
  const anchor = oneOf(v.anchor, ['start', 'center', 'end', 'stretch'] as const);
  if (anchor === 'stretch') {
    const [start, end] = [num(v.start), num(v.end)];
    return start !== undefined && end !== undefined ? { anchor, start, end } : undefined;
  }
  const offset = num(v.offset);
  const size = v.size === 'auto' ? 'auto' : num(v.size);
  return anchor && offset !== undefined && size !== undefined ? { anchor, offset, size } : undefined;
}

function placement(v: unknown): LayerPlacement | undefined {
  if (v === null) return null;
  if (!isObj(v)) return undefined;
  if (v.kind === 'legacy') {
    const pick = (k: string) => (v[k] === null ? null : num(v[k]));
    const out: Record<string, unknown> = { kind: 'legacy' };
    for (const k of ['xMm', 'yMm', 'widthMm']) if (pick(k) !== undefined) out[k] = pick(k);
    if (num(v.scale) !== undefined) out.scale = num(v.scale);
    return out as unknown as LayerPlacement;
  }
  const [x, y] = [axis(v.x), axis(v.y)];
  return x && y ? { x, y } : undefined;
}

function source(v: unknown): ImageSource | null | undefined {
  if (v === null) return null;
  if (!isObj(v)) return undefined;
  if (v.kind === 'vector' && str(v.id, 80)) return { kind: 'vector', id: v.id as string };
  if (v.kind === 'asset' && str(v.id, 80)) return { kind: 'asset', id: v.id as string };
  if (v.kind === 'role' && typeof v.ref === 'string' && /^(auto|cover|hero|logo|screenshot:\d{1,3})$/.test(v.ref)) return { kind: 'role', ref: v.ref as never };
  return undefined;
}

const stroke = (v: unknown) => {
  if (!isObj(v)) return undefined;
  const out = Object.fromEntries(Object.entries({ color: str(v.color, 40), widthMm: num(v.widthMm), insetMm: num(v.insetMm) }).filter(([, f]) => f !== undefined));
  return Object.keys(out).length > 0 ? out : undefined;
};

const params = (v: unknown) => {
  if (!isObj(v)) return undefined;
  const out = Object.fromEntries(Object.entries({ kind: oneOf(v.kind, CODE_KINDS), pattern: str(v.pattern, 500), color: str(v.color, 40), background: str(v.background, 40) }).filter(([, f]) => f !== undefined));
  return Object.keys(out).length > 0 ? out : undefined;
};

/** The valid fields of a patch or layer, by name. `null` stays null where the field allows it (an empty fill, no image). */
export function sanitizePatch(raw: unknown): LayerPatch {
  if (!isObj(raw)) return {};
  const fields: LayerPatch = {
    name: str(raw.name, 80),
    visible: bool(raw.visible),
    placement: placement(raw.placement),
    rotationDeg: num(raw.rotationDeg),
    opacity: ((o) => (o === undefined ? undefined : Math.min(1, Math.max(0, o))))(num(raw.opacity)),
    shape: oneOf(raw.shape, ['rect', 'ellipse'] as const),
    fill: raw.fill === null ? null : str(raw.fill, 40),
    stroke: stroke(raw.stroke),
    source: source(raw.source),
    fit: oneOf(raw.fit, ['fill', 'fit'] as const),
    tint: str(raw.tint, 40),
    text: str(raw.text, 2000),
    textTemplate: str(raw.textTemplate, 2000),
    fontFamily: str(raw.fontFamily, 200),
    color: str(raw.color, 40),
    textHeightMm: num(raw.textHeightMm),
    textRotationDeg: num(raw.textRotationDeg),
    params: params(raw.params),
  };
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
}

const ID = /^[\w.:-]{1,80}$/;

/** A layer from a saved document, or null when it can't be one. */
export function sanitizeLayer(raw: unknown): Layer | null {
  if (!isObj(raw) || typeof raw.id !== 'string' || !ID.test(raw.id)) return null;
  const target = oneOf(raw.target, TARGETS);
  if (!target) return null;
  const fields = sanitizePatch(raw);
  const make = {
    shape: () => newShape(raw.id as string, target),
    image: () => newImage(raw.id as string, target, null, { placement: null }),
    text: () => newText(raw.id as string, target),
    generated: () => newCode(raw.id as string, target),
  }[raw.type as string];
  if (!make) return null;
  const layer = make() as Layer & { params?: object; stroke?: object };
  const follows = str(raw.follows, 80);
  // Fields that don't belong to the type are ignored by drawing, but dropping them keeps saves tidy.
  const keep = Object.keys(layer);
  const merged = { ...layer, ...Object.fromEntries(Object.entries(fields).filter(([k]) => keep.includes(k) || k === 'name')), ...(follows && { follows }) } as Layer;
  const nested = merged as Layer & { params?: object; stroke?: object };
  if (merged.type === 'generated') nested.params = { ...layer.params, ...(fields.params as object) };
  if (merged.type === 'shape') nested.stroke = { ...layer.stroke, ...(fields.stroke as object) };
  return merged;
}

/** A layer diff from a saved document: valid patches, ids, layers and order only. */
export function sanitizeDiff(raw: unknown): LayerDiff | undefined {
  if (!isObj(raw)) return undefined;
  const ids = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ID.test(x)).slice(0, 500) : []);
  const patch: Record<string, LayerPatch> = {};
  if (isObj(raw.patch)) {
    for (const [id, p] of Object.entries(raw.patch).slice(0, 500)) {
      if (!ID.test(id)) continue;
      const clean = sanitizePatch(p);
      if (Object.keys(clean).length > 0) patch[id] = clean;
    }
  }
  const added: NonNullable<LayerDiff['added']> = [];
  const seen = new Set<string>();
  if (Array.isArray(raw.added)) {
    for (const a of raw.added.slice(0, 200)) {
      const layer = isObj(a) ? sanitizeLayer(a.layer) : null;
      if (!layer || seen.has(layer.id)) continue;
      seen.add(layer.id);
      const after = isObj(a) && typeof a.after === 'string' && ID.test(a.after) ? a.after : undefined;
      added.push({ layer, ...(after && { after }) });
    }
  }
  const out: LayerDiff = { patch, hidden: ids(raw.hidden), added, order: ids(raw.order) };
  for (const k of ['patch', 'hidden', 'added', 'order'] as const) {
    const v = out[k];
    if (v === undefined || (Array.isArray(v) ? v.length === 0 : Object.keys(v).length === 0)) delete out[k];
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** The asset library from a saved document. */
export function sanitizeAssets(raw: unknown): Record<string, Asset> {
  const out: Record<string, Asset> = {};
  if (!isObj(raw)) return out;
  for (const [id, a] of Object.entries(raw).slice(0, 500)) {
    if (!ID.test(id) || !isObj(a) || !isObj(a.source)) continue;
    const name = str(a.name, 200) ?? id;
    const src = a.source.kind === 'url' && str(a.source.url, 2000) ? { kind: 'url' as const, url: a.source.url as string } : a.source.kind === 'local' && str(a.source.ref, 100) ? { kind: 'local' as const, ref: a.source.ref as string } : null;
    if (!src) continue;
    out[id] = { id, name, source: src, ...(num(a.size) !== undefined && { size: num(a.size) }), ...(num(a.width) !== undefined && { width: num(a.width) }), ...(num(a.height) !== undefined && { height: num(a.height) }), ...(str(a.hash, 128) && { hash: a.hash as string }) };
  }
  return out;
}
