import { useEffect, useRef, useState, type RefObject } from 'react';
import { useAppDispatch } from '../../context/AppContext';
import { getCachedImage } from '../../engine/imageCache';
import { containsPoint, layerAt, layerBounds, type Bounds, type BoundsEnv } from '../../engine/layers/bounds';
import { duplicateLayer } from '../../engine/layers/factory';
import { HANDLES, MOVING, canResize, moveRect, placementFromRect, resizeRect, sidesOf, snapRect, snapTargets, type Guide, type Handle, type SnapTargets } from '../../engine/layers/manipulate';
import type { RectMm } from '../../engine/box';
import type { LayerEditor } from './layers/useLayerEditor';
import { inTextBox } from './inTextBox';

/** Pointer travel (px) below which a press on a layer counts as a click, not a drag. */
const SLOP_PX = 3;
/** How near, in screen px, a dragged edge has to be to a guide line to snap to it, and how close to a handle counts as on it. */
const SNAP_PX = 6;
const HANDLE_PX = 9;
/** The margin a panel's safe area keeps from its edge, which dragged layers snap to. */
const SAFE_MM = 3;

const CURSOR: Record<Handle, string> = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };

export const handlePoint = (r: RectMm, h: Handle): { x: number; y: number } => ({
  x: h.includes('w') ? r.xMm : h.includes('e') ? r.xMm + r.widthMm : r.xMm + r.widthMm / 2,
  y: h.includes('n') ? r.yMm : h.includes('s') ? r.yMm + r.heightMm : r.yMm + r.heightMm / 2,
});

interface Drag {
  mode: 'move' | Handle;
  bounds: Bounds;
  startX: number;
  startY: number;
  startRect: RectMm;
  moved: boolean;
  targets: SnapTargets;
}

/**
 * Picking, moving and resizing layers on the 2D canvas. A press on a layer selects it (switching to its tab), dragging
 * moves it, and the handles of the selected one resize it. Edges snap to the panel's edges, middle and safe margin and to
 * other layers (hold Alt to switch snapping off); the arrow keys nudge, Delete removes, Ctrl/⌘+D duplicates and Escape
 * lets go. Everything it writes is the same anchored placement the inspector edits, as one undo step per drag.
 */
export function useLayerDrag(ed: LayerEditor, canvasRef: RefObject<HTMLCanvasElement | null>) {
  const dispatch = useAppDispatch();
  const { template, item, assets, layers } = ed;
  const env: BoundsEnv = { template, item, assets, getImage: getCachedImage };
  const selectedLayer = layers.find((l) => l.id === ed.state.selectedLayerId) ?? null;
  const selected = selectedLayer ? layerBounds(selectedLayer, env) : null;

  const drag = useRef<Drag | null>(null);
  const latest = useRef({ ed, env, selected });
  const pending = useRef<{ placement: ReturnType<typeof placementFromRect>; id: string } | null>(null);
  const frame = useRef(0);
  useEffect(() => {
    latest.current = { ed, env, selected };
  });
  const [guides, setGuides] = useState<Guide[]>([]);
  const [readout, setReadout] = useState<string | null>(null);
  const [cursor, setCursor] = useState('');

  /** The pointer in canvas mm, and how many CSS px make a mm on screen. */
  const where = (e: { clientX: number; clientY: number }) => {
    const r = canvasRef.current!.getBoundingClientRect();
    const s = r.width / template.totalWidthMm;
    return { x: (e.clientX - r.left) / s, y: (e.clientY - r.top) / s, s };
  };

  const handleAt = (b: Bounds | null, x: number, y: number, s: number): Handle | null => {
    if (!b || !b.movable || (b.whole && b.layer.type !== 'image') || !canResize(b.layer)) return null;
    return HANDLES.find((h) => Math.hypot(x - handlePoint(b.rect, h).x, y - handlePoint(b.rect, h).y) <= HANDLE_PX / s) ?? null;
  };

  /** A picture covering its whole panel isn't picked by clicking the panel, but once chosen from the list it can be moved by dragging it. */
  const pickedWhole = (x: number, y: number): Bounds | null => (selected?.whole && selected.movable && selected.layer.type === 'image' && containsPoint(selected, x, y) ? selected : null);

  const flush = () => {
    frame.current = 0;
    const p = pending.current;
    pending.current = null;
    if (p) latest.current.ed.update(p.id, { placement: p.placement }, 'drag');
  };

  function down(e: React.PointerEvent): boolean {
    if (e.button !== 0 || !item) return false;
    const { x, y, s } = where(e);
    const handle = handleAt(selected, x, y, s);
    const hit = handle ? selected : (layerAt(layers, env, x, y) ?? pickedWhole(x, y));
    if (!hit) return false;
    if (hit.layer.id !== ed.state.selectedLayerId || hit.layer.target !== ed.state.selectedPanel) {
      if (hit.layer.target !== ed.state.selectedPanel) dispatch({ type: 'selectPanel', panel: hit.layer.target });
      dispatch({ type: 'selectLayer', id: hit.layer.id });
    }
    if (!hit.movable) return true;
    const others = layers.filter((l) => l.id !== hit.layer.id && l.target === hit.layer.target).map((l) => layerBounds(l, env)).filter((b): b is Bounds => !!b && !b.whole).map((b) => b.rect);
    drag.current = { mode: handle ?? 'move', bounds: hit, startX: e.clientX, startY: e.clientY, startRect: hit.rect, moved: false, targets: snapTargets(hit.panel, others, SAFE_MM) };
    return true;
  }

  function move(e: React.PointerEvent): boolean {
    const d = drag.current;
    if (!d) {
      if (!item) return false;
      const { x, y, s } = where(e);
      const h = handleAt(selected, x, y, s);
      const next = h ? CURSOR[h] : (layerAt(layers, env, x, y) ?? pickedWhole(x, y))?.movable ? 'move' : '';
      if (next !== cursor) setCursor(next);
      return false;
    }
    const { s } = where(e);
    const [dx, dy] = [(e.clientX - d.startX) / s, (e.clientY - d.startY) / s];
    if (!d.moved && Math.hypot(dx * s, dy * s) < SLOP_PX) return true;
    d.moved = true;
    const move = d.mode === 'move';
    const lockAspect = !move && d.mode.length === 2 && !e.shiftKey ? d.bounds.aspect : undefined;
    let rect = move ? moveRect(d.startRect, dx, dy) : resizeRect(d.startRect, d.mode as Handle, dx, dy, lockAspect);
    if (!e.altKey && !lockAspect) {
      const snapped = snapRect(rect, move ? MOVING : sidesOf(d.mode as Handle), d.targets, SNAP_PX / s, move);
      rect = snapped.rect;
      setGuides(snapped.guides);
    } else setGuides([]);
    setReadout(`${Math.round(rect.widthMm * 10) / 10} × ${Math.round(rect.heightMm * 10) / 10} mm`);
    const h = d.mode === 'move' ? '' : d.mode;
    const placement = placementFromRect(d.bounds.panel, d.bounds.layer.placement, rect, { x: h.includes('e') || h.includes('w'), y: h.includes('n') || h.includes('s') });
    pending.current = { placement, id: d.bounds.layer.id };
    if (!frame.current) frame.current = requestAnimationFrame(flush);
    return true;
  }

  function up(): boolean {
    const d = drag.current;
    if (!d) return false;
    cancelAnimationFrame(frame.current);
    flush();
    drag.current = null;
    setGuides([]);
    setReadout(null);
    // Selecting changes nothing in the design, which ends the undo step this drag was part of.
    dispatch({ type: 'selectLayer', id: d.bounds.layer.id });
    return true;
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { ed: cur, env: cenv, selected: sel } = latest.current;
      if (!sel || inTextBox(e.target) || e.altKey) return;
      const id = sel.layer.id;
      if (e.key === 'Escape') cur.select(null);
      else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        cur.remove(id);
        cur.select(null);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        cur.add(duplicateLayer(sel.layer, cur.layers.map((l) => l.id)), id);
      } else if (e.key.startsWith('Arrow') && sel.movable && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        const step = e.shiftKey ? 5 : 0.5;
        const [dx, dy] = e.key === 'ArrowLeft' ? [-step, 0] : e.key === 'ArrowRight' ? [step, 0] : e.key === 'ArrowUp' ? [0, -step] : [0, step];
        const b = layerBounds(sel.layer, cenv) ?? sel;
        cur.update(id, { placement: placementFromRect(b.panel, b.layer.placement, moveRect(b.rect, dx, dy), { x: false, y: false }) }, 'nudge');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  return { down, move, up, guides, readout, cursor, selected };
}
