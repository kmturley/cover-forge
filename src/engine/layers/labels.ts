import type { MediaItem } from '../../types/media';
import type { PanelSettings, SpineSettings, CodeKind } from '../../types/editor';
import type { Asset, Layer, LayerDiff } from '../../types/layers';
import type { PanelId } from '../../types/template';
import { getMark } from '../../brands';
import { libraryImages } from '../imageLibrary';
import { settingsToDiff } from './fromSettings';
import { fillLabel } from './paint';

export const CODE_LABELS: Record<CodeKind, string> = { none: 'None', qr: 'QR code', ean13: 'Barcode · EAN-13', upca: 'Barcode · UPC-A', code128: 'Barcode · Code 128' };

/** Layers the case supplies are named `<panel>.<slot>`; ones a user adds are named `<type>-<n>`. */
export const isDefaultId = (id: string): boolean => id.includes('.');

export const SLOT_NAMES: Record<string, string> = { fill: 'Panel colour', image: 'Image', border: 'Border', logo: 'Logo', code: 'QR code & barcode', text: 'Spine text' };

/** The name of a default layer from its id, for one that isn't in the list (a removed one). */
export const slotName = (id: string): string => SLOT_NAMES[id.slice(id.lastIndexOf('.') + 1)] ?? id;

/** What a layer is called in the list: its own name, else what it is. */
export function layerName(l: Layer): string {
  if (l.name) return l.name;
  const slot = isDefaultId(l.id) ? SLOT_NAMES[l.id.slice(l.id.lastIndexOf('.') + 1)] : undefined;
  if (slot) return slot;
  switch (l.type) {
    case 'shape':
      return l.shape === 'ellipse' ? 'Ellipse' : 'Rectangle';
    case 'image':
      return l.source?.kind === 'vector' ? 'Mark' : 'Image';
    case 'text':
      return 'Text';
    case 'generated':
      return l.generator === 'svg' ? 'Custom graphic' : CODE_LABELS[l.params.kind === 'none' ? 'qr' : l.params.kind];
    case 'group':
      return 'Folder';
  }
}

/** A short description of what is in a layer, shown beside its name. */
export function layerDetail(l: Layer, item: MediaItem | null, assets: Readonly<Record<string, Asset>>): string {
  switch (l.type) {
    case 'shape': {
      const stroke = l.stroke.widthMm > 0 ? `${l.stroke.widthMm} mm line` : '';
      return [fillLabel(l.fill) === 'none' && stroke ? '' : fillLabel(l.fill), stroke].filter(Boolean).join(' · ');
    }
    case 'image': {
      const s = l.source;
      if (!s) return 'None';
      if (s.kind === 'vector') {
        const m = getMark(s.id);
        return m ? (m.kind === 'brand' ? m.brand.label : m.logo.label) : 'Unknown mark';
      }
      if (s.kind === 'asset') return assets[s.id]?.name ?? 'Missing image';
      if (s.ref === 'auto') return 'Automatic';
      return (item && libraryImages(item).find((i) => i.ref === s.ref)?.label) ?? 'Image';
    }
    case 'text': {
      const t = l.text ?? l.textTemplate ?? (isDefaultId(l.id) ? '' : '{title}');
      return t || 'Title';
    }
    case 'generated':
      return l.generator === 'svg' ? 'SVG' : l.params.kind === 'none' ? 'None' : `${CODE_LABELS[l.params.kind]}`;
    case 'group':
      return '';
  }
}

/** True for a layer that draws nothing yet (a default slot nobody has filled in): shown dimmed, still there to fill in. */
export function isEmptyLayer(l: Layer): boolean {
  switch (l.type) {
    case 'shape':
      return !l.fill && l.stroke.widthMm <= 0;
    case 'image':
      return !l.source;
    case 'generated':
      return l.generator === 'code' && l.params.kind === 'none';
    default:
      return false;
  }
}

/** The ids of layers a level (the Default design, a design, or an item) changes in any way. */
export function touchedIds(level: { panels?: Partial<Record<PanelId, PanelSettings>>; spine?: Partial<SpineSettings>; diff?: LayerDiff }): Set<string> {
  const ids = new Set<string>(Object.keys(settingsToDiff(level.panels, level.spine).patch ?? {}));
  const d = level.diff;
  for (const id of Object.keys(d?.patch ?? {})) ids.add(id);
  for (const a of d?.added ?? []) ids.add(a.layer.id);
  for (const id of d?.hidden ?? []) ids.add(id);
  return ids;
}
