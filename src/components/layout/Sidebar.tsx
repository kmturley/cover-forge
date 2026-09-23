import { useRef, type ReactNode } from 'react';
import { useSidebarWidth } from './useSidebarWidth';

const LIMITS = { defaultWidth: { left: 290, right: 260 }, min: 220, max: 560 };

const ChevronLeft = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10 3 5 8l5 5" />
  </svg>
);
const ChevronRight = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M6 3l5 5-5 5" />
  </svg>
);

/** A side panel that can be drag-resized and collapsed to a slim rail, so its content never has to truncate or wrap. */
export function Sidebar({ side, label, children }: { side: 'left' | 'right'; label: string; children: ReactNode }) {
  const { width, setWidth, collapsed, setCollapsed } = useSidebarWidth(side, { defaultWidth: LIMITS.defaultWidth[side], min: LIMITS.min, max: LIMITS.max });
  const drag = useRef<{ startX: number; startW: number } | null>(null);

  function onPointerDown(e: React.PointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { startX: e.clientX, startW: width };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const delta = e.clientX - drag.current.startX;
    setWidth(drag.current.startW + (side === 'left' ? delta : -delta));
  }
  function endDrag() {
    drag.current = null;
  }

  if (collapsed) {
    return (
      <div className={`sidebar-rail ${side}`}>
        <button className="sidebar-toggle" title={`Show ${label}`} aria-label={`Show ${label}`} onClick={() => setCollapsed(false)}>
          {side === 'left' ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>
    );
  }

  return (
    <aside className={`sidebar ${side} pane`} style={{ width }}>
      <button className="sidebar-toggle" title={`Hide ${label}`} aria-label={`Hide ${label}`} onClick={() => setCollapsed(true)}>
        {side === 'left' ? <ChevronLeft /> : <ChevronRight />}
      </button>
      {children}
      <div
        className="sidebar-resizer"
        role="separator"
        aria-orientation="vertical"
        aria-label={`Resize ${label}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDoubleClick={() => setWidth(LIMITS.defaultWidth[side])}
      />
    </aside>
  );
}
