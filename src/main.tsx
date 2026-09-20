import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { hydrateLocalImages } from './storage/localImages';
import { readStartup } from './context/share';
import './styles/global.css';

async function start() {
  await hydrateLocalImages();
  // A shared link's settings are read once, then removed from the address bar so later edits and reloads aren't overridden.
  const startup = window.location.search ? await readStartup(window.location.search) : undefined;
  if (startup) window.history.replaceState(null, '', window.location.pathname + window.location.hash);
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App startup={startup} />
    </StrictMode>,
  );
}

void start();
