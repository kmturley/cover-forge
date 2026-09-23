import { useCallback, useState } from 'react';

interface Options {
  defaultWidth: number;
  min: number;
  max: number;
}

function readNumber(key: string, fallback: number): number {
  try {
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) && v > 0 ? v : fallback;
  } catch {
    return fallback;
  }
}

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // private window or full storage: the size just doesn't persist
  }
}

/** A sidebar's width and collapsed state, remembered per browser (not part of the shared session). */
export function useSidebarWidth(side: 'left' | 'right', { defaultWidth, min, max }: Options) {
  const widthKey = `coverforge:sidebar:${side}:width`;
  const collapsedKey = `coverforge:sidebar:${side}:collapsed`;
  const [width, setWidthState] = useState(() => readNumber(widthKey, defaultWidth));
  const [collapsed, setCollapsedState] = useState(() => readFlag(collapsedKey));

  const setWidth = useCallback(
    (next: number) => {
      const clamped = Math.min(max, Math.max(min, Math.round(next)));
      setWidthState(clamped);
      write(widthKey, String(clamped));
    },
    [widthKey, min, max],
  );

  const setCollapsed = useCallback(
    (next: boolean) => {
      setCollapsedState(next);
      write(collapsedKey, next ? '1' : '0');
    },
    [collapsedKey],
  );

  return { width, setWidth, collapsed, setCollapsed };
}
