import { existsSync, readdirSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Owned/licensed clips (docs/VIDEO-SOURCES.md) are precached only if present.
const hasOwnedMedia = existsSync('public/media') && readdirSync('public/media').some((f) => /\.(mp4|webm|vtt)$/.test(f));

// Static, local-first build. Relative base so the app works from any HTTPS
// sub-path (e.g. https://example.github.io/a-little-stronger/).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    sourcemap: false,
    // One precached bundle (React + zod + all bilingual copy) is fine for a local-first PWA.
    chunkSizeWarningLimit: 900,
  },
  plugins: [
    react(),
    VitePWA({
      // "prompt": a new service worker waits. The app only applies it when no
      // practice session is active (see src/pwa/updateGuard.ts).
      registerType: 'prompt',
      injectRegister: false,
      strategies: 'generateSW',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'icons/*.png'],
      manifest: {
        id: './',
        name: '一点力 · A Little Stronger',
        short_name: '一点力',
        description:
          'A small, gentle home strength practice at your own pace. 一点一点，慢慢来。',
        lang: 'en',
        dir: 'ltr',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#FAF7F2',
        theme_color: '#1B6158',
        categories: ['health', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // First-party shell, instructions and owned assets only. Clips placed in
        // public/media/ must be owned or licensed (see docs/VIDEO-SOURCES.md).
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}', ...(hasOwnedMedia ? ['media/**/*.{mp4,webm,vtt}'] : [])],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false,
        // Deliberately no runtimeCaching: third-party (YouTube) media is never
        // cached or precached.
      },
      devOptions: { enabled: false },
    }),
  ],
});
