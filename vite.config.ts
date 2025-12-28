import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
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
    chunkSizeWarningLimit: 250,

    rollupOptions: {
      output: {
        /**
         * Manual chunk splitting strategy:
         * 
         * 1. react-core: React runtime (loaded on every page, cached long-term)
         * 2. router: React Router (loaded on every page)
         * 3. tiptap: Rich text editor (only loaded when editing comments/reports)
         * 4. forms: Form handling libs (only loaded on forms)
         * 5. markdown: Markdown rendering (only loaded on detail pages)
         * 6. icons: Icon library (large, tree-shaken but still heavy)
         * 7. vendor: Everything else from node_modules
         * 
         * Benefits:
         * - Initial bundle only loads react-core + router + icons
         * - Tiptap (~150kb) only loads when user opens comment editor
         * - Forms only load on /crear-reporte
         * - Better cache invalidation (update tiptap without busting react cache)
         */
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined // Let Vite handle app code splitting via lazy routes
          }

          // 1. React Core - loaded everywhere, cache forever
          if (id.includes('react-dom') || id.includes('scheduler')) {
            return 'react-core'
          }
          if (id.includes('/react/') || id.includes('react/jsx-runtime')) {
            return 'react-core'
          }

          // 2. Router - loaded everywhere
          if (id.includes('react-router') || id.includes('@remix-run')) {
            return 'router'
          }

          // 3. Tiptap Rich Text Editor - heavy, lazy load only when needed
          if (id.includes('@tiptap') || id.includes('prosemirror')) {
            return 'tiptap'
          }

          // 4. Form handling - only on form pages
          if (
            id.includes('react-hook-form') ||
            id.includes('@hookform') ||
            id.includes('zod')
          ) {
            return 'forms'
          }

          // 5. Markdown rendering - only on detail pages
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

          // 6. Icons - large but commonly used
          if (id.includes('lucide-react')) {
            return 'icons'
          }

          // 7. General vendors - everything else
          return 'vendor'
        },
      },
    },
  },
})
