import { useState } from 'react';
import type { PanelId } from '../types/template';
import { useAppState } from './AppContext';

/**
 * Set when a panel has just been selected (a click on the art or a tab), with a key that changes each time so the
 * viewer can flash it again. Null until the first selection after the viewer opened, so switching 2D/3D doesn't flash.
 */
export function useSelectionPulse(): { panel: PanelId; key: number } | null {
  const { selectedPanel, panelPulse } = useAppState();
  const [opened] = useState(panelPulse);
  return panelPulse !== opened ? { panel: selectedPanel, key: panelPulse } : null;
}
