import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './ui/styles.css';
import { App } from './ui/App';
import { Stage } from './ui/Stage';
import { DebugOverlay } from './dev/DebugOverlay';
import { DevMapPage } from './dev/DevMapPage';
import { DevRoomsPage } from './dev/DevRoomsPage';
import { DevRaidPage } from './dev/DevRaidPage';
import { DevModelsPage } from './dev/DevModelsPage';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');

// The raid replay and map debugger pages exist only in development builds.
const showDevRaid = import.meta.env.DEV && window.location.pathname.endsWith('/dev/raid');
const showDevRooms = import.meta.env.DEV && window.location.pathname.endsWith('/dev/rooms');
const showDevModels = import.meta.env.DEV && window.location.pathname.endsWith('/dev/models');
const showDevMap = import.meta.env.DEV && window.location.pathname.endsWith('/dev/map');

createRoot(rootEl).render(
  <StrictMode>
    {showDevModels ? (
      <DevModelsPage />
    ) : showDevRooms ? (
      <DevRoomsPage />
    ) : showDevMap ? (
      <DevMapPage />
    ) : showDevRaid ? (
      <DevRaidPage />
    ) : (
      <Stage>
        <App />
      </Stage>
    )}
    {import.meta.env.DEV && !showDevRaid && !showDevMap && !showDevRooms && !showDevModels && (
      <DebugOverlay />
    )}
  </StrictMode>,
);
