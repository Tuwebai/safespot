import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import packageJson from './package.json'

// Generate a unique build hash (shortened timestamp + version or git hash if available)
const buildHash = Math.random().toString(36).substring(2, 9);
const buildTime = new Date().toISOString();

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    // 1. STANDARD IMPORTS
    'import.meta.env.PACKAGE_VERSION': JSON.stringify(packageJson.version),

    // 2. ENTERPRISE VERSIONING (SSOT: deployId)
    'import.meta.env.APP_VERSION': JSON.stringify(packageJson.version),
    'import.meta.env.APP_BUILD_HASH': JSON.stringify(buildHash),
    'import.meta.env.APP_DEPLOY_ID': JSON.stringify(buildTime), // ISO timestamp as deployId

    // 3. SERVICE WORKER INJECTION
    '__SW_VERSION__': JSON.stringify(`${packageJson.version}_${buildHash}`),
  },
  plugins: [
    react(),
    {
      name: 'generate-version-json',
      // Serve virtual version.json in DEV
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/version.json' || req.url?.startsWith('/version.json?')) {
            const versionInfo = {
              deployId: new Date().toISOString(),
              appVersion: packageJson.version,
              environment: 'development',
              buildHash: 'dev_' + Date.now().toString().slice(-6)
            };
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(versionInfo));
            return;
          }
          next();
        });
      },
      closeBundle() {
        // Generate version.json for client-side deploy tracking
        const versionInfo = {
          deployId: buildTime, // ISO timestamp as SSOT
          appVersion: packageJson.version,
          environment: 'production',
          buildHash: buildHash // Optional, for debugging
        };
        const outputPath = path.resolve(__dirname, 'dist', 'version.json');

        // Ensure dist exists (it should after build)
        if (fs.existsSync(path.resolve(__dirname, 'dist'))) {
          fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));
          console.log(`[Vite] Generated version.json: deployId=${versionInfo.deployId}`);
        }
      }
    },
    VitePWA({
      strategies: 'injectManifest', // Use custom SW
      srcDir: 'src',
      filename: 'sw.ts', // Source file is now TS
      registerType: 'autoUpdate', // Automatic update flow
      injectRegister: null, // We register manually in main.tsx
      includeAssets: ['favicon.ico', 'robots.txt'],
      devOptions: {
        enabled: true,
        type: 'module', // Required for src/sw.js in dev
      },
      manifest: {
        name: 'SafeSpot',
        short_name: 'SafeSpot',
        description: 'Plataforma comunitaria para reportar objetos perdidos y encontrados',
        theme_color: '#00ff88',
        background_color: '#020617',
        display: 'standalone',
        start_url: '/',
        // @ts-expect-error - Required for Chrome VAPID/Push compatibility
        gcm_sender_id: "103953800507",
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
    dedupe: ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-router-dom',
      'framer-motion',
      'lucide-react',
      '@tanstack/react-query'
    ],
    exclude: [],
  },
  server: {
    port: 5174,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  base: '/',
  build: {
    emptyOutDir: true,
    target: 'es2020',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - changes rarely, high cache value
          'vendor-react': ['react', 'react-dom', 'react-router-dom', 'react-helmet-async'],

          // Data layer - changes rarely
          'vendor-query': ['@tanstack/react-query'],

          // UI animations - medium change frequency
          'vendor-ui': ['framer-motion', 'lucide-react'],

          // Map - lazy loaded via route, large bundle
          'vendor-map': ['leaflet', 'react-leaflet', 'react-leaflet-cluster'],

          // Rich text editor - lazy loaded, large bundle
          'vendor-editor': [
            '@tiptap/react',
            '@tiptap/starter-kit',
            '@tiptap/extension-mention',
            '@tiptap/extension-placeholder',
            '@tiptap/extension-character-count',
            '@tiptap/extension-underline',
          ],

          // Form handling
          'vendor-forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
        },
      },
    },
  },
})
