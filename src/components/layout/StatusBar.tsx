import { useAppState } from '../../context/AppContext';
import { canvasSizePx } from '../../templates';

export function StatusBar({ message }: { message?: string }) {
  const { items, template } = useAppState();
  const { width, height } = canvasSizePx(template);
  return (
    <footer className="statusbar">
      <span>{items.length} in queue</span>
      <span>
        {template.totalWidthMm} × {template.totalHeightMm} mm incl. bleed · {width} × {height} px @ 300 DPI
      </span>
      {message && <span>{message}</span>}
    </footer>
  );
}
