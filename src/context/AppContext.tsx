import { createContext, useContext, useEffect, useMemo, useReducer, useState, type Dispatch, type ReactNode } from 'react';
import type { MediaItem } from '../types/media';
import type { PanelId, TemplateConfig } from '../types/template';
import type { Design, PanelSettings, SharedSettings, SpineSettings } from '../types/editor';
import { DEFAULT_DESIGN_ID } from '../engine/designs';
import { DEFAULT_TEMPLATE_ID, buildTemplateById } from '../templates';
import { syncTemplate } from './templateOf';
import { LEGACY_FIELDS } from '../engine/box';

export { templateIdOf, templateOf } from './templateOf';
import { defaultTemplateFor, isTemplateId, type LastTemplates } from '../templates/library';
import { sortItems } from './items';
import { loadSession, restoreSession, saveSession } from './session';
import { applyParams, type Startup } from './share';

export type ViewMode = '2d' | '3d';
/** Whether panel edits go to the selected item's design (shared with every item using it) or to that item's own overrides. */
export type EditMode = 'shared' | 'override';

export interface AppState {
  items: MediaItem[];
  selectedItemId: string | null;
  /** UI-only (not persisted). */
  selectedPanel: PanelId;
  /** UI-only (not persisted). Counts panel selections (even of the same panel), so the viewer can flash it. */
  panelPulse: number;
  /** UI-only (not persisted). */
  editMode: EditMode;
  /** The template for an empty queue (and any item without one). Also the last one picked, which new items prefer. */
  templateId: string;
  /** The selected item's template, built (`templateId`'s when nothing is selected). Derived: the reducer keeps it in step. */
  template: TemplateConfig;
  /** The case last picked per media type, which new items of that type start with. */
  lastTemplates: LastTemplates;
  /** Draw each template's official banner (platform or format header). */
  banner: boolean;
  /** UI-only (not persisted): guides are a preview aid, so they start off on every visit. */
  showGuides: boolean;
  /** UI-only (not persisted): dimension lines in mm on the 2D and 3D views. */
  showMeasurements: boolean;
  view: ViewMode;
  /** UI-only (not persisted): slowly spins the 3D model as a hands-free product demo. */
  autoRotate: boolean;
  shared: SharedSettings;
  /** Named designs on top of the Default one (`shared`); an item picks one with `designId`. See engine/designs.ts. */
  designs: Design[];
}

/** `id: null` targets a design (`design` in the action, else the selected item's); a string targets that item's overrides. */
export type Action =
  | { type: 'addItem'; item: MediaItem }
  | { type: 'removeItem'; id: string }
  /** Adds an image (e.g. an upload) to an item's library; it becomes `screenshot:<index>`. */
  | { type: 'addAsset'; id: string; url: string }
  | { type: 'selectItem'; id: string | null }
  /** Replaces the whole working session (e.g. a loaded config file). */
  | { type: 'loadState'; state: AppState }
  | { type: 'selectPanel'; panel: PanelId }
  | { type: 'setEditMode'; mode: EditMode }
  /** Gives the items a template (none = just the empty-queue one); new items of their types then start with it too. */
  | { type: 'setItemTemplate'; items: string[]; template: string }
  | { type: 'setBanner'; banner: boolean }
  | { type: 'setShowGuides'; show: boolean }
  | { type: 'setShowMeasurements'; show: boolean }
  | { type: 'setView'; view: ViewMode }
  | { type: 'setAutoRotate'; autoRotate: boolean }
  | { type: 'updatePanel'; id: string | null; panel: PanelId; patch: Partial<PanelSettings>; design?: string }
  | { type: 'updateSpine'; id: string | null; patch: Partial<SpineSettings>; design?: string }
  /** Gives the items a design (null = Default). */
  | { type: 'assignDesign'; items: string[]; design: string | null }
  /** Adds a design (a copy of `from`'s own settings; nothing for Default) and gives it to the items. */
  | { type: 'forkDesign'; id: string; name: string; from: string; items: string[] }
  | { type: 'renameDesign'; id: string; name: string }
  /** Removes a design; the items using it go back to Default. */
  | { type: 'deleteDesign'; id: string }
  /** Empties a design (or one panel of it); for Default that resets it to the built-in look. */
  | { type: 'clearDesign'; design: string; panel?: PanelId }
  /** Removes an item's overrides for one panel (or all of them), so it follows the shared settings again. */
  | { type: 'clearOverrides'; id: string; panel?: PanelId };

export const initialState: AppState = {
  items: [],
  selectedItemId: null,
  selectedPanel: 'front',
  panelPulse: 0,
  editMode: 'shared',
  templateId: DEFAULT_TEMPLATE_ID,
  template: buildTemplateById(DEFAULT_TEMPLATE_ID),
  lastTemplates: {},
  banner: true,
  showGuides: false,
  showMeasurements: false,
  view: '3d',
  autoRotate: true,
  shared: {
    panels: {},
    spine: { fontFamily: 'Helvetica, Arial, sans-serif', color: '#ffffff' },
  },
  designs: [],
};

/** Drops undefined values so "cleared" fields disappear from state and from saved JSON. */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/** The design edits go to by default: the one the selected item uses (Default if none, or if it was deleted). */
export function targetDesignId(state: Pick<AppState, 'items' | 'selectedItemId' | 'designs'>): string {
  const item = state.items.find((i) => i.id === state.selectedItemId);
  return item?.designId && state.designs.some((d) => d.id === item.designId) ? item.designId : DEFAULT_DESIGN_ID;
}

type Layer = { panels: SharedSettings['panels']; spine: Partial<SharedSettings['spine']> };

/** Applies `f` to a design's own settings: `shared` for Default, otherwise the design with that id. */
function editDesign(state: AppState, id: string, f: (layer: Layer) => Layer): AppState {
  if (id === DEFAULT_DESIGN_ID) {
    const next = f(state.shared);
    return { ...state, shared: { panels: next.panels, spine: next.spine as SharedSettings['spine'] } };
  }
  return { ...state, designs: state.designs.map((d) => (d.id === id ? { ...d, ...f(d) } : d)) };
}

/** A layer with a patch on top; a patch that sets `box` also unsets the layer's older mm fields. */
function withBox<T extends object>(existing: T | undefined, patch: Partial<T>, legacy: readonly string[]): T {
  const next = { ...existing, ...patch } as Record<string, unknown>;
  if ('box' in patch) for (const k of legacy) if (!(k in patch)) next[k] = undefined;
  return next as T;
}

/** Merges a panel patch. `transform`, `logo`, `code` and `border` merge field by field; setting one to undefined clears it. */
function mergePanel(existing: PanelSettings | undefined, patch: Partial<PanelSettings>): PanelSettings {
  const next: PanelSettings = { ...existing, ...patch };
  // Nested layers merge field by field; a field set to undefined is cleared so it inherits again.
  // Writing a box replaces the layer's older mm placement (see LegacyPlacement), so the two never mix.
  if (patch.transform) next.transform = compact(withBox(existing?.transform, patch.transform, LEGACY_FIELDS.transform));
  if (patch.logo) next.logo = compact(withBox(existing?.logo, patch.logo, LEGACY_FIELDS.logo));
  if (patch.code) next.code = compact(withBox(existing?.code, patch.code, LEGACY_FIELDS.code));
  if (patch.border) next.border = compact({ ...existing?.border, ...patch.border });
  return compact(next);
}

function updateItem(state: AppState, id: string, f: (i: MediaItem) => MediaItem): AppState {
  return { ...state, items: state.items.map((i) => (i.id === id ? f(i) : i)) };
}

export function reducer(state: AppState, action: Action): AppState {
  return syncTemplate(apply(state, action));
}

function apply(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'addItem': {
      if (state.items.some((i) => i.id === action.item.id)) {
        return { ...state, selectedItemId: action.item.id };
      }
      const templateId = isTemplateId(action.item.templateId) ? action.item.templateId : defaultTemplateFor(action.item.type, state.lastTemplates, state.templateId);
      return { ...state, items: sortItems([...state.items, { ...action.item, templateId }]), selectedItemId: action.item.id };
    }
    case 'removeItem': {
      const items = state.items.filter((i) => i.id !== action.id);
      const selectedItemId = state.selectedItemId === action.id ? (items[0]?.id ?? null) : state.selectedItemId;
      return { ...state, items, selectedItemId, editMode: items.length ? state.editMode : 'shared' };
    }
    case 'addAsset':
      return updateItem(state, action.id, (i) => ({ ...i, assets: { ...i.assets, screenshots: [...i.assets.screenshots, action.url] } }));
    case 'loadState':
      return action.state;
    case 'selectItem':
      return { ...state, selectedItemId: action.id };
    case 'selectPanel':
      return { ...state, selectedPanel: action.panel, panelPulse: state.panelPulse + 1 };
    case 'setEditMode':
      return { ...state, editMode: action.mode };
    case 'setItemTemplate': {
      if (!isTemplateId(action.template)) return state;
      const ids = new Set(action.items);
      const lastTemplates = { ...state.lastTemplates };
      for (const i of state.items) if (ids.has(i.id)) lastTemplates[i.type] = action.template;
      return { ...state, templateId: action.template, lastTemplates, items: state.items.map((i) => (ids.has(i.id) ? { ...i, templateId: action.template } : i)) };
    }
    case 'setBanner':
      return { ...state, banner: action.banner };
    case 'setShowGuides':
      return { ...state, showGuides: action.show };
    case 'setShowMeasurements':
      return { ...state, showMeasurements: action.show };
    case 'setView':
      return { ...state, view: action.view };
    case 'setAutoRotate':
      return { ...state, autoRotate: action.autoRotate };
    case 'updatePanel': {
      if (action.id === null) {
        return editDesign(state, action.design ?? targetDesignId(state), (layer) => ({
          ...layer,
          panels: { ...layer.panels, [action.panel]: mergePanel(layer.panels[action.panel], action.patch) },
        }));
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
        // A field set to undefined is cleared (e.g. text height back to automatic).
        return editDesign(state, action.design ?? targetDesignId(state), (layer) => ({ ...layer, spine: compact({ ...layer.spine, ...style }) }));
      }
      return updateItem(state, action.id, (i) => ({ ...i, spineOverride: compact({ ...i.spineOverride, ...action.patch }) }));
    }
    case 'assignDesign': {
      const ids = new Set(action.items);
      const exists = action.design !== null && state.designs.some((d) => d.id === action.design);
      return { ...state, items: state.items.map((i) => {
        if (!ids.has(i.id)) return i;
        const next = { ...i };
        if (exists) next.designId = action.design!;
        else delete next.designId;
        return next;
      }) };
    }
    case 'forkDesign': {
      const source = action.from === DEFAULT_DESIGN_ID ? undefined : state.designs.find((d) => d.id === action.from);
      const design: Design = { id: action.id, name: action.name, panels: structuredClone(source?.panels ?? {}), spine: { ...source?.spine } };
      return reducer({ ...state, designs: [...state.designs, design] }, { type: 'assignDesign', items: action.items, design: action.id });
    }
    case 'renameDesign':
      return { ...state, designs: state.designs.map((d) => (d.id === action.id ? { ...d, name: action.name } : d)) };
    case 'deleteDesign':
      return { ...state, designs: state.designs.filter((d) => d.id !== action.id), items: state.items.map((i) => {
        if (i.designId !== action.id) return i;
        const next = { ...i };
        delete next.designId;
        return next;
      }) };
    case 'clearDesign': {
      const spineToo = !action.panel || action.panel === 'spine' || action.panel === 'spineRight';
      return editDesign(state, action.design, (layer) => {
        const panels = { ...layer.panels };
        if (action.panel) delete panels[action.panel];
        const spine = spineToo ? (action.design === DEFAULT_DESIGN_ID ? initialState.shared.spine : {}) : layer.spine;
        return { panels: action.panel ? panels : {}, spine };
      });
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
const StorageContext = createContext(true);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

/** The starting state: the link's config if it has one, otherwise the saved session, then any plain link parameters on top. */
function startState(defaults: AppState, startup?: Startup): AppState {
  const base = startup?.session ? restoreSession(startup.session, defaults) : loadSession(defaults);
  return startup ? applyParams(base, startup.params) : base;
}

export function AppProvider({ children, startup }: { children: ReactNode; startup?: Startup }) {
  const [state, dispatch] = useReducer(reducer, initialState, (d) => startState(d, startup));
  const [storageOk, setStorageOk] = useState(true);

  // Debounced so drags, sliders and typing don't hammer localStorage.
  useEffect(() => {
    const t = setTimeout(() => setStorageOk(saveSession(state)), 300);
    return () => clearTimeout(t);
  }, [state]);

  return (
    <StateContext.Provider value={state}>
      <StorageContext.Provider value={storageOk}>
        <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
      </StorageContext.Provider>
    </StateContext.Provider>
  );
}

export function useAppState(): AppState {
  const s = useContext(StateContext);
  if (!s) throw new Error('useAppState must be used inside AppProvider');
  return s;
}

/** False when the last attempt to save the session failed (e.g. the browser's storage is full). */
export const useStorageOk = () => useContext(StorageContext);

export function useAppDispatch(): Dispatch<Action> {
  const d = useContext(DispatchContext);
  if (!d) throw new Error('useAppDispatch must be used inside AppProvider');
  return d;
}

export function useSelectedItem(): MediaItem | null {
  const { items, selectedItemId } = useAppState();
  return useMemo(() => items.find((i) => i.id === selectedItemId) ?? null, [items, selectedItemId]);
}
