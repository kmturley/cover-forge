import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { hydrateLocalImages } from './storage/localImages';
import './styles/global.css';

void hydrateLocalImages().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
