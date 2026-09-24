import { useAppDispatch, useAppState } from '../../context/AppContext';

/** 2D / 3D switch, the guide lines toggle, and (in 3D) an auto-rotate demo spin. They only change the viewer, so they sit inside it. */
export function ViewerControls() {
  const { showGuides, view, autoRotate } = useAppState();
  const dispatch = useAppDispatch();
  return (
    <div className="viewer-controls" onPointerDown={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()}>
      <div className="seg" role="group" aria-label="View">
        <button className={view === '2d' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: '2d' })}>
          2D
        </button>
        <button className={view === '3d' ? 'active' : ''} onClick={() => dispatch({ type: 'setView', view: '3d' })}>
          3D
        </button>
      </div>
      <label className="check">
        <input type="checkbox" checked={showGuides} onChange={(e) => dispatch({ type: 'setShowGuides', show: e.target.checked })} />
        Guides
      </label>
      {view === '3d' && (
        <label className="check">
          <input type="checkbox" checked={autoRotate} onChange={(e) => dispatch({ type: 'setAutoRotate', autoRotate: e.target.checked })} />
          Auto-rotate
        </label>
      )}
    </div>
  );
}
