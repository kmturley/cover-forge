import { useEffect } from 'react';
import { useAppDispatch, useAppState } from '../../context/AppContext';

/** True when a key press belongs to a text box, which has an undo of its own for what is typed in it. */
const inTextBox = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search|number|url|email|tel|password)$/.test((t as HTMLInputElement).type)));

/** Undo and redo for everything made in the design: the buttons, and Ctrl/⌘+Z and Ctrl/⌘+Shift+Z (or Ctrl+Y). */
export function UndoRedo() {
  const { history } = useAppState();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || inTextBox(e.target)) return;
      const k = e.key.toLowerCase();
      if (k === 'z') {
        e.preventDefault();
        dispatch({ type: e.shiftKey ? 'redo' : 'undo' });
      } else if (k === 'y') {
        e.preventDefault();
        dispatch({ type: 'redo' });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dispatch]);

  return (
    <div className="undo-redo" role="group" aria-label="Undo and redo">
      <button onClick={() => dispatch({ type: 'undo' })} disabled={history.past.length === 0} title="Undo (Ctrl/⌘+Z)" aria-label="Undo">
        ↶ Undo
      </button>
      <button onClick={() => dispatch({ type: 'redo' })} disabled={history.future.length === 0} title="Redo (Ctrl/⌘+Shift+Z)" aria-label="Redo">
        ↷ Redo
      </button>
    </div>
  );
}
