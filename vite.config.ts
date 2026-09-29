import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: { host: true },
  build: { target: 'es2022', assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
  plugins: [
    // The dev server injects CSS as inline <style> tags, which the page's CSP blocks. Allow them in
    // development only; the production build links a stylesheet and keeps the strict policy.
    {
      name: 'dev-inline-styles',
      apply: 'serve',
      transformIndexHtml: (html: string) => html.replace("default-src 'self';", "default-src 'self'; style-src 'self' 'unsafe-inline';"),
    },
    // §20: an installable, fully offline game. Everything is precached at install; updates wait
    // for the player (registerType 'prompt') and are applied at the next cold launch.
    VitePWA({
      strategies: 'generateSW',
      registerType: 'prompt',
      injectRegister: false,
      manifest: {
        name: 'Detour Division',
        short_name: 'Detour Div.',
        description: 'An open-field tower defence game. Send them the long way round.',
        lang: 'en-GB',
        display: 'standalone',
        orientation: 'landscape',
        theme_color: '#5e3a1a',
        background_color: '#5e3a1a',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff,woff2,webp,png,json,m4a,mp3,ogg,wav}'],
        // The largest atlas page is a few MB; the default 2 MB cap would silently skip it.
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
});
