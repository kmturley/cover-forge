import { useMemo } from 'react';
import { targetDesignId, useAppState, useSelectedItem } from '../../context/AppContext';
import { resolvePanel, resolveSpine, type ResolvedPanel } from '../../engine/resolve';
import { DEFAULT_DESIGN_ID, designLayer, designOf, layeredShared } from '../../engine/designs';
import type { PanelSettings, SpineSettings } from '../../types/editor';
import type { PanelId } from '../../types/template';

export interface EditView {
  /** True when edits go to the selected item's own overrides rather than to its design. */
  isOverride: boolean;
  /** The design being edited (`default` or a design id). */
  designId: string;
  /** Settings as they resolve for what is being edited: the item (with its overrides), or its design on its own. */
  resolved: ResolvedPanel;
  spine: SpineSettings;
  /** What is stored at exactly this level for the panel (the design's own settings or the item's overrides), for "clear" buttons. */
  own: PanelSettings | undefined;
}

/** What the sidebar controls show and where their edits go. */
export function useEditView(panel: PanelId): EditView {
  const state = useAppState();
  const { shared, designs, editMode } = state;
  const item = useSelectedItem();
  const isOverride = editMode === 'override' && !!item;
  const designId = targetDesignId(state);
  const layered = useMemo(() => layeredShared(shared, designOf(designs, item)), [shared, designs, item]);
  const viewItem = item && !isOverride ? { ...item, panels: undefined, spineOverride: undefined } : item;
  return {
    isOverride,
    designId,
    resolved: resolvePanel(layered, viewItem, panel),
    spine: resolveSpine(layered, isOverride ? item : null),
    own: isOverride ? item?.panels?.[panel] : designLayer(shared, designs, designId).panels[panel],
  };
}

export { DEFAULT_DESIGN_ID };
