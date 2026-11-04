import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { VitePWA } from 'vite-plugin-pwa';
import pkg from './package.json';
import { SUPABASE_URL } from './src/config';

// Content Security Policy for the web build: the app may only talk to itself,
// the Cat Snap Supabase project, OpenStreetMap tiles and OpenStreetMap place search. (The Android build
// uses --mode native and skips this, because Capacitor injects its own script.)
const csp = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  `img-src 'self' data: blob: https://tile.openstreetmap.org ${SUPABASE_URL}`,
  `connect-src 'self' ${SUPABASE_URL} ${SUPABASE_URL.replace('https://', 'wss://')} https://nominatim.openstreetmap.org`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

// BASE_PATH lets the same build serve from a sub-folder (GitHub Pages: /catsnap/).
const base = process.env.BASE_PATH || '/';

export default defineConfig(({ mode }) => ({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [
    react(),
    {
      name: 'catsnap-csp',
      transformIndexHtml(html: string, ctx: { server?: unknown }) {
        const inject = !ctx.server && mode !== 'native';
        return html.replace('<!--CSP-->', inject ? `<meta http-equiv="Content-Security-Policy" content="${csp}" />` : '');
      },
    },
    // `npm run dev:phone` serves over HTTPS on your LAN so phone GPS and camera work.
    ...(mode === 'phone' ? [basicSsl()] : []),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg', 'demo/*.jpg'],
      manifest: {
        name: 'Cat Snap',
        short_name: 'Cat Snap',
        description: 'Snap, rate and track cats you meet out in the world.',
        theme_color: '#f3f1ea',
        background_color: '#f3f1ea',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2}'],
        // Never cache account or API traffic in the service worker.
        navigateFallbackDenylist: [/^\/auth/, /^\/rest/],
        runtimeCaching: [
          {
            // Map tiles: keep recently viewed areas for offline use in the field.
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*/,
            handler: 'CacheFirst',
            options: { cacheName: 'map-tiles', expiration: { maxEntries: 800, maxAgeSeconds: 60 * 60 * 24 * 14 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
  test: { environment: 'node' },
}));
