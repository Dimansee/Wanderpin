import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  build: {
    rollupOptions: {
      output: { manualChunks: { firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'], react: ['react', 'react-dom', 'react-router-dom'] } }
    }
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Wanderpin',
        short_name: 'Wanderpin',
        description: 'Plan trips, find cafes, couple spots and food, dodge scams, and turn travel reels into itineraries.',
        theme_color: '#2B2420',
        background_color: '#F5EFE6',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ],
        // Lets Android users share an Instagram reel straight into the installed app
        share_target: {
          action: '/import',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' }
        }
      },
      workbox: {
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin.includes('open-meteo.com'),
            handler: 'NetworkFirst',
            options: { cacheName: 'weather', expiration: { maxEntries: 50, maxAgeSeconds: 3600 } }
          },
          {
            urlPattern: ({ url }) => url.origin.includes('wikivoyage.org') || url.origin.includes('overpass'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'guides', expiration: { maxEntries: 200, maxAgeSeconds: 7 * 24 * 3600 } }
          }
        ]
      }
    })
  ]
});
