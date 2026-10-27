import { useEffect } from 'react';
import { AppProvider, useAppDispatch } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { fetchGameById } from './api/steam';
import type { Startup } from './context/share';

/** Adds the games named in the link (`?app=…`) to the queue, with the link's template if it names one, and selects the last one. */
function DeepLinkGames({ apps, templateId }: { apps: number[]; templateId?: string }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const id of apps) {
        const item = await fetchGameById(id);
        if (item && !cancelled) dispatch({ type: 'addItem', item: templateId ? { ...item, templateId } : item });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apps, templateId, dispatch]);
  return null;
}

/** Closes an open dropdown menu (a `details.menu`) when something outside it is pressed, or on Escape. */
function CloseMenusOnOutsideClick() {
  useEffect(() => {
    const close = (keep?: EventTarget | null) =>
      document.querySelectorAll<HTMLDetailsElement>('details.menu[open]').forEach((d) => {
        if (!(keep instanceof Node && d.contains(keep))) d.removeAttribute('open');
      });
    const down = (e: PointerEvent) => close(e.target);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', down, true);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down, true);
      document.removeEventListener('keydown', key);
    };
  }, []);
  return null;
}

export default function App({ startup }: { startup?: Startup }) {
  return (
    <AppProvider startup={startup}>
      {startup && startup.params.apps.length > 0 && <DeepLinkGames apps={startup.params.apps} templateId={startup.params.template} />}
      <CloseMenusOnOutsideClick />
      <AppShell />
    </AppProvider>
  );
}
