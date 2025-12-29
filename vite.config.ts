import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'robots.txt'],
      workbox: {
        // Assets to precache during install
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

        // Runtime caching rules
        runtimeCaching: [
          // API GET requests - Stale While Revalidate
          // Returns cached data immediately, then updates in background
          {
            urlPattern: /^https?:\/\/.*\/api\/(reports|comments|users|gamification|favorites|badges)/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Images - Cache First (images rarely change)
          {
            urlPattern: /\.(?:png|gif|jpg|jpeg|webp|svg)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
              },
            },
          },
          // Fonts - Cache First (fonts never change)
          {
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
              },
            },
          },
        ],
      },
      manifest: {
        name: 'SafeSpot',
        short_name: 'SafeSpot',
        description: 'Plataforma comunitaria para reportar objetos perdidos y encontrados',
        theme_color: '#00ff88',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-192.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    // CRITICAL: Prevent duplicate React instances in production
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
  },
  server: {
    port: 5174,
  },
  build: {
    // Target modern browsers for smaller output
    target: 'es2020',

    // Generate source maps for production debugging (optional)
    sourcemap: false,

    // Chunk size warning threshold (250kb is reasonable)
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        /**
         * Simplified chunk splitting strategy:
         * Keep React in vendor to avoid loading order issues.
         * Only separate truly lazy-loaded heavy deps.
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined // Let Vite handle app code splitting via lazy routes
          }

          // Tiptap Rich Text Editor - heavy, lazy load only when needed
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'tiptap'
          }

          // Markdown rendering - only on detail pages
          if (
            id.includes('react-markdown') ||
            id.includes('remark') ||
            id.includes('unified') ||
            id.includes('mdast') ||
            id.includes('micromark') ||
            id.includes('hast')
          ) {
            return 'markdown'
          }

          // Everything else (including React) in vendor - safer for production
          return 'vendor'
        },
      },
    },
  },
})
