import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyWaitingUpdate, initServiceWorker, subscribeToUpdates } from './pwa/registerSW';
import './styles/app.css';

initServiceWorker();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(
  <StrictMode>
    <App updateSource={{ subscribe: subscribeToUpdates, apply: applyWaitingUpdate }} />
  </StrictMode>,
);
