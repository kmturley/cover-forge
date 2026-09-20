import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppState, useSelectedItem } from '../../context/AppContext';
import { CanvasRenderer } from '../../engine/CanvasRenderer';
import { InteractionController } from '../../engine/InteractionController';

export function CanvasEditor() {
  const { template, shared, showGuides, editMode } = useAppState();
  const item = useSelectedItem();
  const dispatch = useAppDispatch();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const itemIdRef = useRef<string | null>(null);
  const editModeRef = useRef(editMode);

  // Engine lifetime = component lifetime; React only pushes scene updates into it.
  useEffect(() => {
    const canvas = canvasRef.current!;
    const renderer = new CanvasRenderer(canvas);
    const controller = new InteractionController(
      canvas,
      renderer,
      (panel, transform) => {
        // Shared mode edits every item's layer; override mode only the selected item's.
        const id = editModeRef.current === 'shared' ? null : itemIdRef.current;
        if (editModeRef.current === 'shared' || id) dispatch({ type: 'updatePanel', id, panel, patch: { transform } });
      },
      (panel) => dispatch({ type: 'selectPanel', panel }),
    );
    rendererRef.current = renderer;
    return () => {
      controller.dispose();
      renderer.dispose();
      rendererRef.current = null;
    };
  }, [dispatch]);

  useEffect(() => {
    itemIdRef.current = item?.id ?? null;
    editModeRef.current = editMode;
    rendererRef.current?.setScene({ template, item, shared, showGuides });
  }, [template, item, shared, showGuides, editMode]);

  return (
    <div className="canvas-wrap">
      <canvas
        ref={canvasRef}
        className="editor-canvas"
        style={{ aspectRatio: `${template.totalWidthMm} / ${template.totalHeightMm}` }}
      />
      {!item && <p className="empty-hint">Add a game to the queue to start editing.</p>}
    </div>
  );
}
