import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import { DebugOverlay } from './dev/DebugOverlay';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

createRoot(rootEl).render(
  <StrictMode>
    <App />
    {import.meta.env.DEV && <DebugOverlay />}
  </StrictMode>,
);
