import { useEffect } from 'react';
import { AppProvider, useAppDispatch } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { fetchGameById } from './api/steam';
import type { Startup } from './context/share';

/** Adds the games named in the link (`?app=…`) to the queue and selects the last one. */
function DeepLinkGames({ apps }: { apps: number[] }) {
  const dispatch = useAppDispatch();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      for (const id of apps) {
        const item = await fetchGameById(id);
        if (item && !cancelled) dispatch({ type: 'addItem', item });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apps, dispatch]);
  return null;
}

export default function App({ startup }: { startup?: Startup }) {
  return (
    <AppProvider startup={startup}>
      {startup && startup.params.apps.length > 0 && <DeepLinkGames apps={startup.params.apps} />}
      <AppShell />
    </AppProvider>
  );
}
