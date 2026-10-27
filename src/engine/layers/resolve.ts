import type { MediaItem } from '../../types/media';
import type { Design, SharedSettings } from '../../types/editor';
import type { TemplateConfig } from '../../types/template';
import type { Layer, ShapeLayer } from '../../types/layers';
import { designOf } from '../designs';
import { applyDiff } from './diff';
import { defaultLayers } from './defaults';
import { brandedFolderId, brandedLayers } from './branded';
import { settingsToDiff } from './fromSettings';

/** What the layers are resolved from. Slot-style settings are read through `settingsToDiff` until state stores diffs itself. */
export interface LayerSources {
  template: TemplateConfig;
  item: MediaItem | null;
  /** The Default design. */
  shared: SharedSettings;
  /** The designs items can use. */
  designs?: readonly Design[];
}

/**
 * The layers to draw for an item on a case, bottom to top: the case's default layers with the Default design, then the
 * item's design, then the item's own changes applied in turn (layer-system-plan.md §2.8). Layers that mirror another
 * (a dust flap's fill) take its resolved look. The dress's patches to a side's title go in first, while that side's
 * Branded folder is shown.
 */
export function resolveLayers({ template, item, shared, designs }: LayerSources): Layer[] {
  const design = designOf(designs, item);
  const levels = [shared.diff, design?.diff, item?.diff];
  // A patch belongs to the side it is on, so it applies only while that side's folder is shown (the last level to say wins).
  const shown = (panel: string) => levels.reduce<boolean>((on, d) => (d?.patch?.[brandedFolderId(panel)] as { visible?: boolean } | undefined)?.visible ?? on, true);
  const dress = Object.fromEntries(Object.entries(brandedLayers(template).patches).filter(([id]) => shown(id.slice(0, id.indexOf('.')))));
  const base = applyDiff(defaultLayers(template), { patch: dress });
  let layers = applyDiff(applyDiff(base, settingsToDiff(shared.panels, shared.spine)), shared.diff);
  if (design) layers = applyDiff(applyDiff(layers, settingsToDiff(design.panels, design.spine)), design.diff);
  if (item) layers = applyDiff(applyDiff(layers, settingsToDiff(item.panels, item.spineOverride)), item.diff);
  return mirrored(layers);
}

function mirrored(layers: Layer[]): Layer[] {
  if (!layers.some((l) => l.follows)) return layers;
  const byId = new Map(layers.map((l) => [l.id, l]));
  return layers.map((l) => {
    const leader = l.follows ? byId.get(l.follows) : undefined;
    return leader?.type === 'shape' && l.type === 'shape' ? ({ ...l, fill: leader.fill, opacity: leader.opacity, visible: leader.visible } satisfies ShapeLayer) : l;
  });
}
