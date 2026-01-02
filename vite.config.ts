import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest', // Use custom SW
      srcDir: 'src',
      filename: 'sw.ts', // Source file is now TS
      registerType: 'autoUpdate',
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
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    exclude: [],
  },
  server: {
    port: 5174,
    proxy: {
      '/reporte': {
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
        manualChunks: undefined
      },
    },
  },
})
