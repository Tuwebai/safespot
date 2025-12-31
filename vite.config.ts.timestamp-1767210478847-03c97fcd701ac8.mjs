// vite.config.ts
import { defineConfig } from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/vite-plugin-pwa/dist/index.js";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/vite.config.ts";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico", "robots.txt"],
      workbox: {
        // Assets to precache during install
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        // Runtime caching rules
        runtimeCaching: [
          // API GET requests - Network First
          // Ensures user always sees fresh data if they have a connection
          {
            urlPattern: /^https?:\/\/.*\/api\/(reports|comments|users|gamification|favorites|badges)/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              // Fallback to cache if network is very slow
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24
                // 24 hours
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Images - Cache First (images rarely change)
          {
            urlPattern: /\.(?:png|gif|jpg|jpeg|webp|svg)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "images-cache",
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24 * 7
                // 7 days
              }
            }
          },
          // Fonts - Cache First (fonts never change)
          {
            urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365
                // 1 year
              }
            }
          }
        ]
      },
      manifest: {
        name: "SafeSpot",
        short_name: "SafeSpot",
        description: "Plataforma comunitaria para reportar objetos perdidos y encontrados",
        theme_color: "#00ff88",
        background_color: "#020617",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "/icons/icon-192.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    },
    // CRITICAL: Prevent duplicate React instances in production
    dedupe: ["react", "react-dom", "react-router-dom"]
  },
  optimizeDeps: {
    include: ["react", "react-dom"],
    // Exclude Leaflet from pre-bundling to prevent SSR/build issues
    // Exclude nothing to ensure CommonJS/ESM interop works in dev
    exclude: []
  },
  server: {
    port: 5174,
    proxy: {
      // API already proxied? Usually api is configured in .env or works via CORS.
      // But we need to proxy /reporte to the backend for local testing of Social Share Logic.
      "/reporte": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  },
  base: "/",
  // Ensure absolute base path for production assets
  build: {
    // Clean outDir before build
    emptyOutDir: true,
    // Target modern browsers for smaller output
    target: "es2020",
    // Asset directory inside dist
    assetsDir: "assets",
    // Generate source maps for production debugging (optional)
    sourcemap: false,
    // Chunk size warning threshold (250kb is reasonable)
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        /**
         * TEMPORARY: manualChunks DISABLED for testing
         * If error disappears, confirms code splitting is the root cause
         */
        manualChunks: void 0
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc3VhcmlvXFxcXERvY3VtZW50c1xcXFxQcm95ZWN0b3MgV2ViXFxcXFNhZmVzcG90XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxVc3VhcmlvXFxcXERvY3VtZW50c1xcXFxQcm95ZWN0b3MgV2ViXFxcXFNhZmVzcG90XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9Vc3VhcmlvL0RvY3VtZW50cy9Qcm95ZWN0b3MlMjBXZWIvU2FmZXNwb3Qvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xyXG5pbXBvcnQgcmVhY3QgZnJvbSAnQHZpdGVqcy9wbHVnaW4tcmVhY3QnXHJcbmltcG9ydCB7IFZpdGVQV0EgfSBmcm9tICd2aXRlLXBsdWdpbi1wd2EnXHJcbmltcG9ydCB7IGZpbGVVUkxUb1BhdGgsIFVSTCB9IGZyb20gJ25vZGU6dXJsJ1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbXHJcbiAgICByZWFjdCgpLFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ3JvYm90cy50eHQnXSxcclxuICAgICAgd29ya2JveDoge1xyXG4gICAgICAgIC8vIEFzc2V0cyB0byBwcmVjYWNoZSBkdXJpbmcgaW5zdGFsbFxyXG4gICAgICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2Zyx3b2ZmMn0nXSxcclxuXHJcbiAgICAgICAgLy8gUnVudGltZSBjYWNoaW5nIHJ1bGVzXHJcbiAgICAgICAgcnVudGltZUNhY2hpbmc6IFtcclxuICAgICAgICAgIC8vIEFQSSBHRVQgcmVxdWVzdHMgLSBOZXR3b3JrIEZpcnN0XHJcbiAgICAgICAgICAvLyBFbnN1cmVzIHVzZXIgYWx3YXlzIHNlZXMgZnJlc2ggZGF0YSBpZiB0aGV5IGhhdmUgYSBjb25uZWN0aW9uXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM/OlxcL1xcLy4qXFwvYXBpXFwvKHJlcG9ydHN8Y29tbWVudHN8dXNlcnN8Z2FtaWZpY2F0aW9ufGZhdm9yaXRlc3xiYWRnZXMpLyxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ05ldHdvcmtGaXJzdCcsXHJcbiAgICAgICAgICAgIG9wdGlvbnM6IHtcclxuICAgICAgICAgICAgICBjYWNoZU5hbWU6ICdhcGktY2FjaGUnLFxyXG4gICAgICAgICAgICAgIG5ldHdvcmtUaW1lb3V0U2Vjb25kczogNSwgLy8gRmFsbGJhY2sgdG8gY2FjaGUgaWYgbmV0d29yayBpcyB2ZXJ5IHNsb3dcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiAxMDAsXHJcbiAgICAgICAgICAgICAgICBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQsIC8vIDI0IGhvdXJzXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICBjYWNoZWFibGVSZXNwb25zZToge1xyXG4gICAgICAgICAgICAgICAgc3RhdHVzZXM6IFswLCAyMDBdLFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgLy8gSW1hZ2VzIC0gQ2FjaGUgRmlyc3QgKGltYWdlcyByYXJlbHkgY2hhbmdlKVxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKD86cG5nfGdpZnxqcGd8anBlZ3x3ZWJwfHN2ZykkLyxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnaW1hZ2VzLWNhY2hlJyxcclxuICAgICAgICAgICAgICBleHBpcmF0aW9uOiB7XHJcbiAgICAgICAgICAgICAgICBtYXhFbnRyaWVzOiA1MCxcclxuICAgICAgICAgICAgICAgIG1heEFnZVNlY29uZHM6IDYwICogNjAgKiAyNCAqIDcsIC8vIDcgZGF5c1xyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgLy8gRm9udHMgLSBDYWNoZSBGaXJzdCAoZm9udHMgbmV2ZXIgY2hhbmdlKVxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICB1cmxQYXR0ZXJuOiAvXFwuKD86d29mZnx3b2ZmMnx0dGZ8b3RmfGVvdCkkLyxcclxuICAgICAgICAgICAgaGFuZGxlcjogJ0NhY2hlRmlyc3QnLFxyXG4gICAgICAgICAgICBvcHRpb25zOiB7XHJcbiAgICAgICAgICAgICAgY2FjaGVOYW1lOiAnZm9udHMtY2FjaGUnLFxyXG4gICAgICAgICAgICAgIGV4cGlyYXRpb246IHtcclxuICAgICAgICAgICAgICAgIG1heEVudHJpZXM6IDEwLFxyXG4gICAgICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0ICogMzY1LCAvLyAxIHllYXJcclxuICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICB9LFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6ICdTYWZlU3BvdCcsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogJ1NhZmVTcG90JyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ1BsYXRhZm9ybWEgY29tdW5pdGFyaWEgcGFyYSByZXBvcnRhciBvYmpldG9zIHBlcmRpZG9zIHkgZW5jb250cmFkb3MnLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzAwZmY4OCcsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwMjA2MTcnLFxyXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcclxuICAgICAgICBzdGFydF91cmw6ICcvJyxcclxuICAgICAgICBpY29uczogW1xyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi0xOTIucG5nJyxcclxuICAgICAgICAgICAgc2l6ZXM6ICcxOTJ4MTkyJyxcclxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBzcmM6ICcvaWNvbnMvaWNvbi0xOTIucG5nJyxcclxuICAgICAgICAgICAgc2l6ZXM6ICc1MTJ4NTEyJyxcclxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIF0sXHJcbiAgICAgIH0sXHJcbiAgICB9KSxcclxuICBdLFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgICdAJzogZmlsZVVSTFRvUGF0aChuZXcgVVJMKCcuL3NyYycsIGltcG9ydC5tZXRhLnVybCkpLFxyXG4gICAgfSxcclxuICAgIC8vIENSSVRJQ0FMOiBQcmV2ZW50IGR1cGxpY2F0ZSBSZWFjdCBpbnN0YW5jZXMgaW4gcHJvZHVjdGlvblxyXG4gICAgZGVkdXBlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJ10sXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJ10sXHJcbiAgICAvLyBFeGNsdWRlIExlYWZsZXQgZnJvbSBwcmUtYnVuZGxpbmcgdG8gcHJldmVudCBTU1IvYnVpbGQgaXNzdWVzXHJcbiAgICAvLyBFeGNsdWRlIG5vdGhpbmcgdG8gZW5zdXJlIENvbW1vbkpTL0VTTSBpbnRlcm9wIHdvcmtzIGluIGRldlxyXG4gICAgZXhjbHVkZTogW10sXHJcbiAgfSxcclxuICBzZXJ2ZXI6IHtcclxuICAgIHBvcnQ6IDUxNzQsXHJcbiAgICBwcm94eToge1xyXG4gICAgICAvLyBBUEkgYWxyZWFkeSBwcm94aWVkPyBVc3VhbGx5IGFwaSBpcyBjb25maWd1cmVkIGluIC5lbnYgb3Igd29ya3MgdmlhIENPUlMuXHJcbiAgICAgIC8vIEJ1dCB3ZSBuZWVkIHRvIHByb3h5IC9yZXBvcnRlIHRvIHRoZSBiYWNrZW5kIGZvciBsb2NhbCB0ZXN0aW5nIG9mIFNvY2lhbCBTaGFyZSBMb2dpYy5cclxuICAgICAgJy9yZXBvcnRlJzoge1xyXG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG4gIGJhc2U6ICcvJywgLy8gRW5zdXJlIGFic29sdXRlIGJhc2UgcGF0aCBmb3IgcHJvZHVjdGlvbiBhc3NldHNcclxuICBidWlsZDoge1xyXG4gICAgLy8gQ2xlYW4gb3V0RGlyIGJlZm9yZSBidWlsZFxyXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXHJcblxyXG4gICAgLy8gVGFyZ2V0IG1vZGVybiBicm93c2VycyBmb3Igc21hbGxlciBvdXRwdXRcclxuICAgIHRhcmdldDogJ2VzMjAyMCcsXHJcblxyXG4gICAgLy8gQXNzZXQgZGlyZWN0b3J5IGluc2lkZSBkaXN0XHJcbiAgICBhc3NldHNEaXI6ICdhc3NldHMnLFxyXG5cclxuICAgIC8vIEdlbmVyYXRlIHNvdXJjZSBtYXBzIGZvciBwcm9kdWN0aW9uIGRlYnVnZ2luZyAob3B0aW9uYWwpXHJcbiAgICBzb3VyY2VtYXA6IGZhbHNlLFxyXG5cclxuICAgIC8vIENodW5rIHNpemUgd2FybmluZyB0aHJlc2hvbGQgKDI1MGtiIGlzIHJlYXNvbmFibGUpXHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDUwMCxcclxuXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIC8qKlxyXG4gICAgICAgICAqIFRFTVBPUkFSWTogbWFudWFsQ2h1bmtzIERJU0FCTEVEIGZvciB0ZXN0aW5nXHJcbiAgICAgICAgICogSWYgZXJyb3IgZGlzYXBwZWFycywgY29uZmlybXMgY29kZSBzcGxpdHRpbmcgaXMgdGhlIHJvb3QgY2F1c2VcclxuICAgICAgICAgKi9cclxuICAgICAgICBtYW51YWxDaHVua3M6IHVuZGVmaW5lZFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KVxyXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1WLFNBQVMsb0JBQW9CO0FBQ2hYLE9BQU8sV0FBVztBQUNsQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxlQUFlLFdBQVc7QUFIa0wsSUFBTSwyQ0FBMkM7QUFNdFEsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUztBQUFBLElBQ1AsTUFBTTtBQUFBLElBQ04sUUFBUTtBQUFBLE1BQ04sY0FBYztBQUFBLE1BQ2QsZUFBZSxDQUFDLGVBQWUsWUFBWTtBQUFBLE1BQzNDLFNBQVM7QUFBQTtBQUFBLFFBRVAsY0FBYyxDQUFDLHNDQUFzQztBQUFBO0FBQUEsUUFHckQsZ0JBQWdCO0FBQUE7QUFBQTtBQUFBLFVBR2Q7QUFBQSxZQUNFLFlBQVk7QUFBQSxZQUNaLFNBQVM7QUFBQSxZQUNULFNBQVM7QUFBQSxjQUNQLFdBQVc7QUFBQSxjQUNYLHVCQUF1QjtBQUFBO0FBQUEsY0FDdkIsWUFBWTtBQUFBLGdCQUNWLFlBQVk7QUFBQSxnQkFDWixlQUFlLEtBQUssS0FBSztBQUFBO0FBQUEsY0FDM0I7QUFBQSxjQUNBLG1CQUFtQjtBQUFBLGdCQUNqQixVQUFVLENBQUMsR0FBRyxHQUFHO0FBQUEsY0FDbkI7QUFBQSxZQUNGO0FBQUEsVUFDRjtBQUFBO0FBQUEsVUFFQTtBQUFBLFlBQ0UsWUFBWTtBQUFBLFlBQ1osU0FBUztBQUFBLFlBQ1QsU0FBUztBQUFBLGNBQ1AsV0FBVztBQUFBLGNBQ1gsWUFBWTtBQUFBLGdCQUNWLFlBQVk7QUFBQSxnQkFDWixlQUFlLEtBQUssS0FBSyxLQUFLO0FBQUE7QUFBQSxjQUNoQztBQUFBLFlBQ0Y7QUFBQSxVQUNGO0FBQUE7QUFBQSxVQUVBO0FBQUEsWUFDRSxZQUFZO0FBQUEsWUFDWixTQUFTO0FBQUEsWUFDVCxTQUFTO0FBQUEsY0FDUCxXQUFXO0FBQUEsY0FDWCxZQUFZO0FBQUEsZ0JBQ1YsWUFBWTtBQUFBLGdCQUNaLGVBQWUsS0FBSyxLQUFLLEtBQUs7QUFBQTtBQUFBLGNBQ2hDO0FBQUEsWUFDRjtBQUFBLFVBQ0Y7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsVUFBVTtBQUFBLFFBQ1IsTUFBTTtBQUFBLFFBQ04sWUFBWTtBQUFBLFFBQ1osYUFBYTtBQUFBLFFBQ2IsYUFBYTtBQUFBLFFBQ2Isa0JBQWtCO0FBQUEsUUFDbEIsU0FBUztBQUFBLFFBQ1QsV0FBVztBQUFBLFFBQ1gsT0FBTztBQUFBLFVBQ0w7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxVQUNSO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFVBQ1I7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssY0FBYyxJQUFJLElBQUksU0FBUyx3Q0FBZSxDQUFDO0FBQUEsSUFDdEQ7QUFBQTtBQUFBLElBRUEsUUFBUSxDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxFQUNuRDtBQUFBLEVBQ0EsY0FBYztBQUFBLElBQ1osU0FBUyxDQUFDLFNBQVMsV0FBVztBQUFBO0FBQUE7QUFBQSxJQUc5QixTQUFTLENBQUM7QUFBQSxFQUNaO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUE7QUFBQTtBQUFBLE1BR0wsWUFBWTtBQUFBLFFBQ1YsUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsTUFBTTtBQUFBO0FBQUEsRUFDTixPQUFPO0FBQUE7QUFBQSxJQUVMLGFBQWE7QUFBQTtBQUFBLElBR2IsUUFBUTtBQUFBO0FBQUEsSUFHUixXQUFXO0FBQUE7QUFBQSxJQUdYLFdBQVc7QUFBQTtBQUFBLElBR1gsdUJBQXVCO0FBQUEsSUFFdkIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsUUFLTixjQUFjO0FBQUEsTUFDaEI7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
