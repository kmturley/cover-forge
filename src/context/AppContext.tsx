import { createContext, useContext, useEffect, useMemo, useReducer, type Dispatch, type ReactNode } from 'react';
import type { MediaItem } from '../types/media';
import type { PanelId, Region, TemplateConfig } from '../types/template';
import type { PanelSettings, SharedSettings, SpineSettings, StyleOverlay } from '../types/editor';
import { createBlurayTemplate, DEFAULT_SPINE } from '../templates';
import { loadSession, saveSession } from './session';

export type ViewMode = '2d' | '3d';
/** Whether panel edits go to the shared settings (all items) or to the selected item's overrides. */
export type EditMode = 'shared' | 'override';

export interface AppState {
  items: MediaItem[];
  selectedItemId: string | null;
  /** UI-only (not persisted). */
  selectedPanel: PanelId;
  /** UI-only (not persisted). */
  editMode: EditMode;
  region: Region;
  template: TemplateConfig;
  styleOverlay: StyleOverlay;
  /** UI-only (not persisted): guides are a preview aid, so they start off on every visit. */
  showGuides: boolean;
  view: ViewMode;
  shared: SharedSettings;
}

/** `id: null` targets the shared settings; a string targets that item's overrides. */
export type Action =
  | { type: 'addItem'; item: MediaItem }
  | { type: 'removeItem'; id: string }
  | { type: 'reorderItems'; from: number; to: number }
  | { type: 'selectItem'; id: string | null }
  | { type: 'selectPanel'; panel: PanelId }
  | { type: 'setEditMode'; mode: EditMode }
  | { type: 'setRegion'; region: Region }
  | { type: 'setSpine'; spineMm: number }
  | { type: 'setStyleOverlay'; style: StyleOverlay }
  | { type: 'setShowGuides'; show: boolean }
  | { type: 'setView'; view: ViewMode }
  | { type: 'updatePanel'; id: string | null; panel: PanelId; patch: Partial<PanelSettings> }
  | { type: 'updateSpine'; id: string | null; patch: Partial<SpineSettings> }
  /** Removes an item's overrides for one panel (or all of them), so it follows the shared settings again. */
  | { type: 'clearOverrides'; id: string; panel?: PanelId };

export const DEFAULT_SPINE_TEXT_HEIGHT_MM = 4;

export const initialState: AppState = {
  items: [],
  selectedItemId: null,
  selectedPanel: 'front',
  editMode: 'shared',
  region: 'US',
  template: createBlurayTemplate('US'),
  styleOverlay: 'clean',
  showGuides: false,
  view: '2d',
  shared: {
    panels: {},
    spine: { fontFamily: 'Helvetica, Arial, sans-serif', textHeightMm: DEFAULT_SPINE_TEXT_HEIGHT_MM, color: '#ffffff' },
  },
};

/** Drops undefined values so "cleared" fields disappear from state and from saved JSON. */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** Merges a panel patch. `transform` and `logo` merge field by field; setting one to undefined clears it. */
function mergePanel(existing: PanelSettings | undefined, patch: Partial<PanelSettings>): PanelSettings {
  const next: PanelSettings = { ...existing, ...patch };
  // Nested layers merge field by field; a field set to undefined is cleared so it inherits again.
  if (patch.transform) next.transform = compact({ ...existing?.transform, ...patch.transform });
  if (patch.logo) next.logo = compact({ ...existing?.logo, ...patch.logo });
  return compact(next);
}

function updateItem(state: AppState, id: string, f: (i: MediaItem) => MediaItem): AppState {
  return { ...state, items: state.items.map((i) => (i.id === id ? f(i) : i)) };
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addItem': {
      if (state.items.some((i) => i.id === action.item.id)) {
        return { ...state, selectedItemId: action.item.id };
      }
      return { ...state, items: [...state.items, action.item], selectedItemId: action.item.id };
    }
    case 'removeItem': {
      const items = state.items.filter((i) => i.id !== action.id);
      const selectedItemId = state.selectedItemId === action.id ? (items[0]?.id ?? null) : state.selectedItemId;
      return { ...state, items, selectedItemId, editMode: items.length ? state.editMode : 'shared' };
    }
    case 'reorderItems': {
      const items = [...state.items];
      const [moved] = items.splice(action.from, 1);
      if (!moved) return state;
      items.splice(action.to, 0, moved);
      return { ...state, items };
    }
    case 'selectItem':
      return { ...state, selectedItemId: action.id };
    case 'selectPanel':
      return { ...state, selectedPanel: action.panel };
    case 'setEditMode':
      return { ...state, editMode: action.mode };
    case 'setRegion':
      return {
        ...state,
        region: action.region,
        template: createBlurayTemplate(action.region, DEFAULT_SPINE[action.region]),
      };
    case 'setSpine':
      return { ...state, template: createBlurayTemplate(state.region, action.spineMm) };
    case 'setStyleOverlay':
      return { ...state, styleOverlay: action.style };
    case 'setShowGuides':
      return { ...state, showGuides: action.show };
    case 'setView':
      return { ...state, view: action.view };
    case 'updatePanel': {
      if (action.id === null) {
        const panels = { ...state.shared.panels, [action.panel]: mergePanel(state.shared.panels[action.panel], action.patch) };
        return { ...state, shared: { ...state.shared, panels } };
      }
      return updateItem(state, action.id, (i) => ({
        ...i,
        panels: { ...i.panels, [action.panel]: mergePanel(i.panels?.[action.panel], action.patch) },
      }));
    }
    case 'updateSpine': {
      if (action.id === null) {
        const { text: _ignored, ...style } = action.patch; // the text is always per item
        void _ignored;
        return { ...state, shared: { ...state.shared, spine: { ...state.shared.spine, ...compact(style) } } };
      }
      return updateItem(state, action.id, (i) => ({ ...i, spineOverride: compact({ ...i.spineOverride, ...action.patch }) }));
    }
    case 'clearOverrides':
      return updateItem(state, action.id, (i) => {
        const next = { ...i };
        if (!action.panel) {
          delete next.panels;
          delete next.spineOverride;
          return next;
        }
        const panels = { ...i.panels };
        delete panels[action.panel];
        next.panels = panels;
        if (action.panel === 'spine') delete next.spineOverride;
        return next;
      });
  }
}

const StateContext = createContext<AppState | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, loadSession);

  // Debounced so drags, sliders and typing don't hammer localStorage.
  useEffect(() => {
    const t = setTimeout(() => saveSession(state), 300);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const s = useContext(StateContext);
  if (!s) throw new Error('useAppState must be used inside AppProvider');
  return s;
}

export function useAppDispatch(): Dispatch<Action> {
  const d = useContext(DispatchContext);
  if (!d) throw new Error('useAppDispatch must be used inside AppProvider');
  return d;
}

export function useSelectedItem(): MediaItem | null {
  const { items, selectedItemId } = useAppState();
  return useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId]);
}
