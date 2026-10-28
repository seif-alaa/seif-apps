import '@fontsource-variable/oxanium';
import '@fontsource-variable/manrope';
import './styles/app.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installAudioUnlock } from './audio/audio';
import { app, matchStore } from './lib/app';
import { ensureNickname } from './lib/settings';
import { net } from './net/net';

ensureNickname();
installAudioUnlock();

// Read-only diagnostics hook used by the automated multi-browser tests.
if (import.meta.env.DEV || import.meta.env.VITE_TEST_HOOKS === '1') {
  (window as unknown as Record<string, unknown>).__pulse = { app, matchStore, net };
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
