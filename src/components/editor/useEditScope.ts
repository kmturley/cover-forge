import { targetDesignId, useAppState, useSelectedItem } from '../../context/AppContext';
import type { PanelId } from '../../types/template';

/** The tab being edited (a panel, or all of them), and whether edits go to the item itself rather than its design. */
export function useEditScope() {
  const state = useAppState();
  const item = useSelectedItem();
  const { template, selectedPanel, editMode } = state;
  const tab: PanelId | 'canvas' = selectedPanel === 'canvas' || template.panels.some((p) => p.id === selectedPanel && !p.follows) ? selectedPanel : (template.panels.find((p) => !p.follows)?.id ?? template.panels[0].id);
  return { tab, isOverride: editMode === 'override' && !!item, designId: targetDesignId(state) };
}
