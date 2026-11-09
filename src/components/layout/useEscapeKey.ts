import { useEffect } from 'react';

/** Calls `onEscape` when Escape is pressed while the component is mounted: a modal closes with it. */
export function useEscapeKey(onEscape: () => void) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onEscape();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onEscape]);
}
