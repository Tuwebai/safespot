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
          // API GET requests - Network First
          // Ensures user always sees fresh data if they have a connection
          {
            urlPattern: /^https?:\/\/.*\/api\/(reports|comments|users|gamification|favorites|badges)/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              networkTimeoutSeconds: 5, // Fallback to cache if network is very slow
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
    // Exclude Leaflet from pre-bundling to prevent SSR/build issues
    exclude: ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],
  },
  server: {
    port: 5174,
  },
  base: '/', // Ensure absolute base path for production assets
  build: {
    // Clean outDir before build
    emptyOutDir: true,

    // Target modern browsers for smaller output
    target: 'es2020',

    // Asset directory inside dist
    assetsDir: 'assets',

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
            return undefined
          }

          // Group 1: Map Engine (Heavy & specialized)
          if (
            id.includes('leaflet') ||
            id.includes('react-leaflet') ||
            id.includes('react-leaflet-cluster')
          ) {
            return 'map-engine'
          }

          // Group 2: Rich Text Editor (Heavy, used only in creation/editing)
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'editor-core'
          }

          // Group 3: Content Transformation & Markdown
          if (
            id.includes('react-markdown') ||
            id.includes('remark') ||
            id.includes('unified') ||
            id.includes('mdast')
          ) {
            return 'content-parser'
          }

          // Group 4: Validation & Forms (Used in Perfil, CrearReporte)
          if (id.includes('react-hook-form') || id.includes('zod') || id.includes('@hookform')) {
            return 'forms-engine'
          }

          // Group 5: Core Framework (Keep together for stability)
          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react-router-dom') ||
            id.includes('@tanstack/react-query')
          ) {
            return 'vendor-core'
          }

          // Everything else: Generic utilities
          return 'vendor-utils'
        },
      },
    },
  },
})
