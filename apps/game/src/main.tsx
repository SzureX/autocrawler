import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App';
import { DebugOverlay } from './dev/DebugOverlay';
import { DevRaidPage } from './dev/DevRaidPage';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

// The raid replay page exists only in development builds.
const showDevRaid = import.meta.env.DEV && window.location.pathname.endsWith('/dev/raid');

createRoot(rootEl).render(
  <StrictMode>
    {showDevRaid ? <DevRaidPage /> : <App />}
    {import.meta.env.DEV && !showDevRaid && <DebugOverlay />}
  </StrictMode>,
);
