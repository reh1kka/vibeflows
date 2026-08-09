/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { spotifyApiPlugin } from './vite/plugins/spotify-api'
import { catalogApiPlugin } from './vite/plugins/catalog-api'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as { version: string }

export default defineConfig({
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    spotifyApiPlugin(),
    catalogApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'favicon.png',
        'favicon-48.png',
        'favicon-64.png',
        'apple-touch-icon.png',
        'logo.png',
      ],
      manifest: {
        name: 'VibeFlows',
        short_name: 'VibeFlows',
        description: 'VibeFlows — discover obscure music genres',
        theme_color: '#00e676',
        background_color: '#121212',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        importScripts: ['sw-alias-redirect.js'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/api\//],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        runtimeCaching: [
          {
            // Prefer network for navigations so phones pick up new deploys
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'pages-v2',
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/genres\.json/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'genres-data-v7',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
            },
          },
          {
            urlPattern: /\/genre-overrides\.json/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'genre-overrides-v4',
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: /\/similarity\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'similarity-data-v5',
              networkTimeoutSeconds: 8,
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 14,
              },
            },
          },
          {
            urlPattern: /\/genre-descriptions\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'genre-descriptions-v4',
              cacheableResponse: {
                statuses: [200],
              },
            },
          },
          {
            urlPattern: /\/artist-fans\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'artist-fans-v2',
              cacheableResponse: { statuses: [200] },
              expiration: {
                maxEntries: 2,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/everynoise': {
        target: 'https://everynoise.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/everynoise/, ''),
      },
      '/deezer': {
        target: 'https://api.deezer.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/deezer/, ''),
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
