import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { useSelectionPulse } from '../../context/useSelectionPulse';
import { CanvasRenderer } from '../../engine/CanvasRenderer';
import { downscaleInto } from '../../engine/downscale';
import { MEASURE_MARGIN_MM, drawMeasurements } from '../../engine/MeasurementOverlay';

const PADDING = 24;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 12;
/** Pointer travel (px) below which a press counts as a click, not a drag. */
const CLICK_SLOP = 4;

interface View {
  /** Canvas centre offset from the viewport centre, in CSS px. */
  ox: number;
  oy: number;
  /** Zoom relative to the fitted size. */
  k: number;
}
const FIT: View = { ox: 0, oy: 0, k: 1 };
/** The reduced copy is sized in steps of this many device px, so zooming does not redo the reduction on every wheel tick. */
const DISPLAY_STEP = 32;

/** The current device pixel ratio, updated when the window moves to another screen or the browser zoom changes. */
function useDevicePixelRatio(): number {
  const [dpr, setDpr] = useState(() => window.devicePixelRatio || 1);
  useEffect(() => {
    const mq = window.matchMedia(`(resolution: ${dpr}dppx)`);
    const onChange = () => setDpr(window.devicePixelRatio || 1);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [dpr]);
  return dpr;
}

/**
 * 2D preview. Like the 3D view, dragging moves the whole canvas and the wheel zooms the whole canvas
 * (about the cursor); images are positioned from the sidebar. A click selects the panel under the cursor.
 */
export function CanvasEditor() {
  const { template, shared, designs, showGuides, showMeasurements, banner } = useAppState();
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const displayRef = useRef<HTMLCanvasElement>(null);
  const measureRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>(FIT);
  const dpr = useDevicePixelRatio();
  const pulse = useSelectionPulse();
  const pulsed = pulse && template.panels.find((p) => p.id === pulse.panel);

  useEffect(() => {
    const renderer = new CanvasRenderer(canvasRef.current!);
    rendererRef.current = renderer;
    return () => {
      renderer.dispose();
      rendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    rendererRef.current?.setScene({ template, item, shared, designs, banner, showGuides, hideOutsideCut: true });
  }, [template, item, shared, designs, banner, showGuides]);

  // Track the viewport size so the canvas can be fitted to it.
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const aspect = template.totalWidthMm / template.totalHeightMm;
  const fitW = box.w ? Math.max(1, Math.min(box.w - PADDING * 2, (box.h - PADDING * 2) * aspect)) : 0;
  const w = fitW * view.k;
  const h = w / aspect;

  // The cover is painted at print resolution, far more pixels than the screen shows. Showing it through CSS scaling looks
  // soft and jagged, so when it is shown smaller than it is painted, a copy reduced to the exact screen size is shown instead.
  const snap = (px: number) => Math.max(DISPLAY_STEP, Math.round(px / DISPLAY_STEP) * DISPLAY_STEP);
  const [targetW, targetH] = [snap(w * dpr), snap(h * dpr)];
  const scaled = fitW > 0 && targetW > 0 && targetW < template.totalWidthMm * template.dpiScale * 0.75;
  const syncDisplay = useCallback(() => {
    const [src, dst] = [canvasRef.current, displayRef.current];
    if (!scaled || !src || !dst) return;
    if (dst.width !== targetW || dst.height !== targetH) {
      dst.width = targetW;
      dst.height = targetH;
    }
    downscaleInto(src, dst);
  }, [scaled, targetW, targetH]);
  // Refresh the copy after every repaint, and straight away (before the browser paints) when only its size or visibility changed.
  useEffect(() => rendererRef.current?.onPaint(syncDisplay), [syncDisplay]);
  useLayoutEffect(syncDisplay, [syncDisplay]);

  // Dimensions live on their own canvas, larger than the cover, so they sit in the margin around it.
  useEffect(() => {
    const c = measureRef.current;
    if (!c || !showMeasurements || !fitW) return;
    const px = (w / template.totalWidthMm) * dpr;
    c.width = Math.round((template.totalWidthMm + MEASURE_MARGIN_MM * 2) * px);
    c.height = Math.round((template.totalHeightMm + MEASURE_MARGIN_MM * 2) * px);
    const ctx = c.getContext('2d')!;
    ctx.translate(MEASURE_MARGIN_MM * px, MEASURE_MARGIN_MM * px);
    drawMeasurements(ctx, template, px);
  }, [template, showMeasurements, w, fitW, dpr]);

  // Wheel zoom must be a non-passive native listener so it can preventDefault (stops the page scrolling).
  const boxRef = useRef(box);
  useEffect(() => {
    boxRef.current = box;
  }, [box]);
  useEffect(() => {
    const el = wrapRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const cx = e.clientX - r.left - boxRef.current.w / 2; // cursor relative to viewport centre
      const cy = e.clientY - r.top - boxRef.current.h / 2;
      setView((v) => {
        const k = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.k * Math.exp(-e.deltaY * 0.0015)));
        const f = k / v.k;
        // Keep the point under the cursor fixed while scaling about it.
        return { k, ox: cx + (v.ox - cx) * f, oy: cy + (v.oy - cy) * f };
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const drag = useRef<{ x: number; y: number; ox: number; oy: number; moved: boolean } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: view.ox, oy: view.oy, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < CLICK_SLOP) return;
    d.moved = true;
    setView((v) => ({ ...v, ox: d.ox + dx, oy: d.oy + dy }));
  }

  function onPointerUp(e: React.PointerEvent) {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // A click: select the panel under the cursor.
    const r = canvasRef.current!.getBoundingClientRect();
    const xMm = ((e.clientX - r.left) / r.width) * template.totalWidthMm;
    const yMm = ((e.clientY - r.top) / r.height) * template.totalHeightMm;
    const panel = template.panels.find((p) => xMm >= p.xMm && xMm < p.xMm + p.widthMm && yMm >= p.yMm && yMm < p.yMm + p.heightMm);
    if (panel) dispatch({ type: 'selectPanel', panel: panel.follows ?? panel.id });
  }

  return (
    <div
      ref={wrapRef}
      className="viewport"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => (drag.current = null)}
      onDoubleClick={() => setView(FIT)}
    >
      <canvas
        ref={canvasRef}
        className="editor-canvas"
        style={{ left: box.w / 2 + view.ox - w / 2, top: box.h / 2 + view.oy - h / 2, width: w, height: h, visibility: fitW && !scaled ? 'visible' : 'hidden' }}
      />
      <canvas
        ref={displayRef}
        className="editor-canvas"
        style={{ left: box.w / 2 + view.ox - w / 2, top: box.h / 2 + view.oy - h / 2, width: w, height: h, visibility: scaled ? 'visible' : 'hidden' }}
      />
      {showMeasurements && fitW > 0 && (
        <canvas
          ref={measureRef}
          className="measure-canvas"
          style={{
            left: box.w / 2 + view.ox - w / 2 - (MEASURE_MARGIN_MM / template.totalWidthMm) * w,
            top: box.h / 2 + view.oy - h / 2 - (MEASURE_MARGIN_MM / template.totalWidthMm) * w,
            width: w + (MEASURE_MARGIN_MM * 2 * w) / template.totalWidthMm,
            height: h + (MEASURE_MARGIN_MM * 2 * w) / template.totalWidthMm,
          }}
        />
      )}
      {pulsed && fitW > 0 && (
        <div
          key={pulse.key}
          className="panel-pulse"
          style={{
            left: box.w / 2 + view.ox - w / 2 + (pulsed.xMm / template.totalWidthMm) * w,
            top: box.h / 2 + view.oy - h / 2 + (pulsed.yMm / template.totalHeightMm) * h,
            width: (pulsed.widthMm / template.totalWidthMm) * w,
            height: (pulsed.heightMm / template.totalHeightMm) * h,
          }}
        />
      )}
      {!item && <p className="empty-hint">Add a game to the queue to start editing.</p>}
      {(view.k !== 1 || view.ox !== 0 || view.oy !== 0) && (
        <button className="fit-button" onClick={() => setView(FIT)} onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
          Fit · {Math.round(view.k * 100)}%
        </button>
      )}
    </div>
  );
}
