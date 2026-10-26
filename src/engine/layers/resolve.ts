import type { MediaItem } from '../../types/media';
import type { Design, SharedSettings } from '../../types/editor';
import type { TemplateConfig } from '../../types/template';
import type { Layer, ShapeLayer } from '../../types/layers';
import { designOf } from '../designs';
import { applyDiff } from './diff';
import { defaultLayers } from './defaults';
import { BRANDED_FOLDER, brandedLayers } from './branded';
import { settingsToDiff } from './fromSettings';

/** What the layers are resolved from. Slot-style settings are read through `settingsToDiff` until state stores diffs itself. */
export interface LayerSources {
  template: TemplateConfig;
  item: MediaItem | null;
  /** The Default design. */
  shared: SharedSettings;
  /** The designs items can use. */
  designs?: readonly Design[];
  /** Whether Branded is on: the dress's folder is shown, and the changes it makes to the spine title apply. */
  banner: boolean;
}

/**
 * The layers to draw for an item on a case, bottom to top: the case's default layers with the Default design, then the
 * item's design, then the item's own changes applied in turn (layer-system-plan.md §2.8). Layers that mirror another
 * (a dust flap's fill) take its resolved look. While Branded is on, the dress's patches to the spine title go in first.
 */
export function resolveLayers({ template, item, shared, designs, banner }: LayerSources): Layer[] {
  const design = designOf(designs, item);
  const base = banner ? applyDiff(defaultLayers(template), { patch: brandedLayers(template).patches }) : defaultLayers(template);
  let layers = applyDiff(applyDiff(base, settingsToDiff(shared.panels, shared.spine)), shared.diff);
  if (design) layers = applyDiff(applyDiff(layers, settingsToDiff(design.panels, design.spine)), design.diff);
  if (item) layers = applyDiff(applyDiff(layers, settingsToDiff(item.panels, item.spineOverride)), item.diff);
  // The folder's eye is the Branded switch, whatever a design or item says about it.
  return mirrored(layers.map((l) => (l.id === BRANDED_FOLDER ? { ...l, visible: banner } : l)));
}

function mirrored(layers: Layer[]): Layer[] {
  if (!layers.some((l) => l.follows)) return layers;
  const byId = new Map(layers.map((l) => [l.id, l]));
  return layers.map((l) => {
    const leader = l.follows ? byId.get(l.follows) : undefined;
    return leader?.type === 'shape' && l.type === 'shape' ? ({ ...l, fill: leader.fill, opacity: leader.opacity, visible: leader.visible } satisfies ShapeLayer) : l;
  });
}
