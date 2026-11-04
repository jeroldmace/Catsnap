import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './ui/App';
import { isNative } from './data/platform';
import { StoreProvider } from './ui/store';
// Fonts are bundled with the app (no requests to Google Fonts).
import '@fontsource/figtree/400.css';
import '@fontsource/figtree/500.css';
import '@fontsource/figtree/600.css';
import '@fontsource/figtree/700.css';
import '@fontsource/bricolage-grotesque/600.css';
import '@fontsource/bricolage-grotesque/800.css';
import '@fontsource/jetbrains-mono/500.css';
import './ui/styles.css';

// Offline support: the app shell is cached and updates itself in the background.
// The native app bundles every file already, so it skips the service worker.
if (!isNative()) registerSW({ immediate: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>,
);
