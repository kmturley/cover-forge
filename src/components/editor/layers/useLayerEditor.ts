import { useMemo } from 'react';
import { targetDesignId, useAppDispatch, useAppState, useSelectedItem } from '../../../context/AppContext';
import { designLayer } from '../../../engine/designs';
import { resolveLayers } from '../../../engine/layers/resolve';
import { touchedIds } from '../../../engine/layers/labels';
import type { Asset, Layer, LayerPatch } from '../../../types/layers';
import type { PanelId, PanelRect } from '../../../types/template';

/**
 * What the layer panel shows and where its edits go: the design the selected item uses, or the item's own changes when
 * "This item" is chosen. The layers shown are the ones that level resolves to (a design's view leaves the item's own
 * changes out), and `touched` says which of them that level itself changes.
 */
export function useLayerEditor() {
  const state = useAppState();
  const dispatch = useAppDispatch();
  const item = useSelectedItem();
  const { template, shared, designs, assets, editMode, selectedPanel, selectedLayerId } = state;

  const isOverride = editMode === 'override' && !!item;
  const designId = targetDesignId(state);
  const target = isOverride ? item!.id : null;
  const tab: PanelId | 'canvas' = selectedPanel === 'canvas' || template.panels.some((p) => p.id === selectedPanel && !p.follows) ? selectedPanel : (template.panels.find((p) => !p.follows)?.id ?? template.panels[0].id);

  const viewItem = useMemo(() => (item && !isOverride ? { ...item, panels: undefined, spineOverride: undefined, diff: undefined } : item), [item, isOverride]);
  const layers = useMemo(() => resolveLayers({ template, item: viewItem, shared, designs }), [template, viewItem, shared, designs]);

  const level = isOverride ? { panels: item!.panels, spine: item!.spineOverride, diff: item!.diff } : designLayer(shared, designs, designId);
  const touched = useMemo(() => touchedIds(level), [level.panels, level.spine, level.diff]); // eslint-disable-line react-hooks/exhaustive-deps

  /** The layers on the current tab, topmost first. Assembly flaps and the Branded dress aren't listed. */
  const tabLayers = useMemo(() => layers.filter((l) => l.target === tab && l.type !== 'official').reverse(), [layers, tab]);
  const selected = tabLayers.find((l) => l.id === selectedLayerId) ?? null;
  const panelRect: PanelRect | null = tab === 'canvas' ? null : (template.panels.find((p) => p.id === tab) ?? null);

  const base = { id: target, design: designId };
  return {
    state, item, template, assets, isOverride, designId, target, tab, layers, tabLayers, touched, selected, panelRect,
    hidden: level.diff?.hidden ?? [],
    select: (id: string | null) => dispatch({ type: 'selectLayer', id }),
    update: (layerId: string, patch: LayerPatch, coalesce?: string) => dispatch({ type: 'updateLayer', ...base, layerId, patch, ...(coalesce && { coalesce: `${target}:${layerId}:${coalesce}` }) }),
    add: (layer: Layer, after?: string, asset?: Asset) => {
      dispatch({ type: 'addLayer', ...base, layer, ...(after !== undefined && { after }), ...(asset && { asset }) });
      dispatch({ type: 'selectLayer', id: layer.id });
    },
    updateMany: (layerIds: string[], patch: LayerPatch) => dispatch({ type: 'updateLayers', ...base, layerIds, patch }),
    remove: (layerId: string) => dispatch({ type: 'removeLayer', ...base, layerId }),
    reset: (layerId: string) => dispatch({ type: 'resetLayer', ...base, layerId }),
    /** Moves a layer up (+1) or down (-1) among the ones listed, by swapping places with its neighbour. */
    move: (layerId: string, dir: 1 | -1) => {
      const at = tabLayers.findIndex((l) => l.id === layerId);
      const other = tabLayers[at - dir];
      if (at < 0 || !other) return;
      const order = layers.map((l) => l.id);
      const [i, j] = [order.indexOf(layerId), order.indexOf(other.id)];
      [order[i], order[j]] = [order[j], order[i]];
      dispatch({ type: 'setLayerOrder', ...base, order });
    },
  };
}

export type LayerEditor = ReturnType<typeof useLayerEditor>;
