import { useAppState, useStorageOk } from '../../context/AppContext';
import { canvasSizePx } from '../../templates';

export function StatusBar({ message }: { message?: string }) {
  const { items, template } = useAppState();
  const storageOk = useStorageOk();
  const { width, height } = canvasSizePx(template);
  return (
    <footer className="statusbar">
      <span>{items.length} in queue</span>
      <span>
        {template.totalWidthMm} × {template.totalHeightMm} mm incl. bleed · {width} × {height} px @ 300 DPI
      </span>
      {!storageOk && (
        <span className="warn" role="alert">
          ⚠ Couldn’t save your session: browser storage is full or blocked. Remove large uploaded images.
        </span>
      )}
      {message && <span>{message}</span>}
    </footer>
  );
}
