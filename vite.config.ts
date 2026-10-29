import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA, type VitePWAOptions } from 'vite-plugin-pwa';
import { cloudflare } from '@cloudflare/vite-plugin';
import path from 'path';

// Spec 19.3: precache the app shell, fonts and icons; no API caching (TanStack Query holds the data).
// /api/* is never answered from the app shell: a navigation to it must reach the Worker (U22).
export const pwaWorkbox: NonNullable<Partial<VitePWAOptions>['workbox']> = {
  globPatterns: ['**/*.{js,css,html,svg,png,woff2,webmanifest}'],
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/api\//],
  cleanupOutdatedCaches: true,
  // The push and notification-click handlers (U34) live in public/push-sw.js; the generated worker loads them
  importScripts: ['push-sw.js'],
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // The API Worker runs beside the app in `vite dev` and is built with it (wrangler.jsonc). Vitest tests the Worker
    // code directly with getPlatformProxy(), so the plugin (which starts workerd) stays out of test runs.
    ...(process.env.VITEST ? [] : [cloudflare()]),
    // The service worker waits for the person to choose Reload; the manifest is the one in public/.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: pwaWorkbox,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}', 'worker/**/*.test.ts'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-icons': ['lucide-react'],
        },
      },
    },
  },
});
