// vite.config.ts
import { defineConfig } from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/vite-plugin-pwa/dist/index.js";
import { fileURLToPath, URL } from "node:url";
import fs from "node:fs";
import path from "node:path";

// package.json
var package_default = {
  name: "safespot",
  private: true,
  version: "2.4.0-pro",
  type: "module",
  scripts: {
    dev: "vite",
    build: "tsc && vite build",
    lint: "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    preview: "vite preview",
    test: "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:contract": "vitest run tests/contract",
    "test:e2e": "playwright test",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:contract && npm run test:e2e",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  },
  dependencies: {
    "@hookform/resolvers": "^5.2.2",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-switch": "^1.2.6",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@react-oauth/google": "^0.13.4",
    "@sentry/react": "^10.34.0",
    "@tanstack/react-query": "^5.90.14",
    "@tanstack/react-virtual": "^3.13.14",
    "@tiptap/extension-character-count": "^3.14.0",
    "@tiptap/extension-mention": "^3.14.0",
    "@tiptap/extension-placeholder": "^3.14.0",
    "@tiptap/extension-underline": "^3.14.0",
    "@tiptap/react": "^3.14.0",
    "@tiptap/starter-kit": "^3.14.0",
    "@tiptap/suggestion": "^3.14.0",
    "browser-image-compression": "^2.0.2",
    "canvas-confetti": "^1.9.4",
    clsx: "^2.0.0",
    "date-fns": "^4.1.0",
    "framer-motion": "^12.23.26",
    leaflet: "^1.9.4",
    "leaflet-gesture-handling": "^1.2.2",
    "lucide-react": "^0.294.0",
    react: "18.2.0",
    "react-dom": "18.2.0",
    "react-helmet-async": "^2.0.5",
    "react-hook-form": "^7.69.0",
    "react-joyride": "^2.9.3",
    "react-leaflet": "^4.2.1",
    "react-leaflet-cluster": "^2.1.0",
    "react-markdown": "^9.0.1",
    "react-router-dom": "^6.20.0",
    "remark-gfm": "^4.0.1",
    "tailwind-merge": "^2.0.0",
    "tippy.js": "^6.3.7",
    uuid: "^13.0.0",
    zod: "^3.22.4",
    zustand: "^4.4.7"
  },
  devDependencies: {
    "@playwright/test": "^1.57.0",
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.1",
    "@types/bcrypt": "^6.0.0",
    "@types/canvas-confetti": "^1.9.0",
    "@types/leaflet": "^1.9.21",
    "@types/node": "^25.0.3",
    "@types/react": "^18.2.37",
    "@types/react-dom": "^18.2.15",
    "@types/supertest": "^6.0.3",
    "@types/uuid": "^10.0.0",
    "@typescript-eslint/eslint-plugin": "^6.10.0",
    "@typescript-eslint/parser": "^6.10.0",
    "@vitejs/plugin-react": "^4.2.0",
    "@vitest/coverage-v8": "^4.0.17",
    autoprefixer: "^10.4.16",
    eslint: "^8.53.0",
    "eslint-plugin-local-rules": "file:eslint-rules",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.4",
    jsdom: "^27.4.0",
    postcss: "^8.4.31",
    supertest: "^7.2.2",
    tailwindcss: "^3.3.5",
    typescript: "^5.2.2",
    vite: "^5.0.0",
    "vite-plugin-pwa": "^1.2.0",
    vitest: "^4.0.17",
    "workbox-window": "^7.4.0"
  },
  engines: {
    node: ">=18"
  }
};

// vite.config.ts
var __vite_injected_original_dirname = "C:\\Users\\Usuario\\Documents\\Proyectos Web\\Safespot";
var __vite_injected_original_import_meta_url = "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/vite.config.ts";
var buildHash = Math.random().toString(36).substring(2, 9);
var buildTime = (/* @__PURE__ */ new Date()).toISOString();
var vite_config_default = defineConfig({
  define: {
    // 1. STANDARD IMPORTS
    "import.meta.env.PACKAGE_VERSION": JSON.stringify(package_default.version),
    // 2. ENTERPRISE VERSIONING (SSOT: deployId)
    "import.meta.env.APP_VERSION": JSON.stringify(package_default.version),
    "import.meta.env.APP_BUILD_HASH": JSON.stringify(buildHash),
    "import.meta.env.APP_DEPLOY_ID": JSON.stringify(buildTime),
    // ISO timestamp as deployId
    // 3. SERVICE WORKER INJECTION
    "__SW_VERSION__": JSON.stringify(`${package_default.version}_${buildHash}`)
  },
  plugins: [
    react(),
    {
      name: "generate-version-json",
      // Serve virtual version.json in DEV
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === "/version.json" || req.url?.startsWith("/version.json?")) {
            const versionInfo = {
              deployId: (/* @__PURE__ */ new Date()).toISOString(),
              appVersion: package_default.version,
              environment: "development",
              buildHash: "dev_" + Date.now().toString().slice(-6)
            };
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(versionInfo));
            return;
          }
          next();
        });
      },
      closeBundle() {
        const versionInfo = {
          deployId: buildTime,
          // ISO timestamp as SSOT
          appVersion: package_default.version,
          environment: "production",
          buildHash
          // Optional, for debugging
        };
        const outputPath = path.resolve(__vite_injected_original_dirname, "dist", "version.json");
        if (fs.existsSync(path.resolve(__vite_injected_original_dirname, "dist"))) {
          fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));
          console.log(`[Vite] Generated version.json: deployId=${versionInfo.deployId}`);
        }
      }
    },
    VitePWA({
      strategies: "injectManifest",
      // Use custom SW
      srcDir: "src",
      filename: "sw.ts",
      // Source file is now TS
      registerType: "autoUpdate",
      // Automatic update flow
      injectRegister: null,
      // We register manually in main.tsx
      includeAssets: ["favicon.ico", "robots.txt"],
      devOptions: {
        enabled: true,
        type: "module"
        // Required for src/sw.js in dev
      },
      manifest: {
        name: "SafeSpot",
        short_name: "SafeSpot",
        description: "Plataforma comunitaria para reportar objetos perdidos y encontrados",
        theme_color: "#00ff88",
        background_color: "#020617",
        display: "standalone",
        start_url: "/",
        // @ts-ignore - Required for Chrome VAPID/Push compatibility
        gcm_sender_id: "103953800507",
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
    dedupe: ["react", "react-dom", "react-router-dom", "react-helmet-async"]
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react-router-dom",
      "react-router-dom",
      "framer-motion",
      "lucide-react",
      "@tanstack/react-query"
    ],
    exclude: []
  },
  server: {
    port: 5174,
    hmr: {
      protocol: "ws",
      host: "localhost"
    },
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        secure: false
      }
    }
  },
  base: "/",
  build: {
    emptyOutDir: true,
    target: "es2020",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React - changes rarely, high cache value
          "vendor-react": ["react", "react-dom", "react-router-dom", "react-helmet-async"],
          // Data layer - changes rarely
          "vendor-query": ["@tanstack/react-query"],
          // UI animations - medium change frequency
          "vendor-ui": ["framer-motion", "lucide-react"],
          // Map - lazy loaded via route, large bundle
          "vendor-map": ["leaflet", "react-leaflet", "react-leaflet-cluster"],
          // Rich text editor - lazy loaded, large bundle
          "vendor-editor": [
            "@tiptap/react",
            "@tiptap/starter-kit",
            "@tiptap/extension-mention",
            "@tiptap/extension-placeholder",
            "@tiptap/extension-character-count",
            "@tiptap/extension-underline"
          ],
          // Form handling
          "vendor-forms": ["react-hook-form", "@hookform/resolvers", "zod"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXN1YXJpb1xcXFxEb2N1bWVudHNcXFxcUHJveWVjdG9zIFdlYlxcXFxTYWZlc3BvdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXN1YXJpb1xcXFxEb2N1bWVudHNcXFxcUHJveWVjdG9zIFdlYlxcXFxTYWZlc3BvdFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvVXN1YXJpby9Eb2N1bWVudHMvUHJveWVjdG9zJTIwV2ViL1NhZmVzcG90L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCdcclxuaW1wb3J0IGZzIGZyb20gJ25vZGU6ZnMnXHJcbmltcG9ydCBwYXRoIGZyb20gJ25vZGU6cGF0aCdcclxuaW1wb3J0IHBhY2thZ2VKc29uIGZyb20gJy4vcGFja2FnZS5qc29uJ1xyXG5cclxuLy8gR2VuZXJhdGUgYSB1bmlxdWUgYnVpbGQgaGFzaCAoc2hvcnRlbmVkIHRpbWVzdGFtcCArIHZlcnNpb24gb3IgZ2l0IGhhc2ggaWYgYXZhaWxhYmxlKVxyXG5jb25zdCBidWlsZEhhc2ggPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMiwgOSk7XHJcbmNvbnN0IGJ1aWxkVGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgZGVmaW5lOiB7XHJcbiAgICAvLyAxLiBTVEFOREFSRCBJTVBPUlRTXHJcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlBBQ0tBR0VfVkVSU0lPTic6IEpTT04uc3RyaW5naWZ5KHBhY2thZ2VKc29uLnZlcnNpb24pLFxyXG5cclxuICAgIC8vIDIuIEVOVEVSUFJJU0UgVkVSU0lPTklORyAoU1NPVDogZGVwbG95SWQpXHJcbiAgICAnaW1wb3J0Lm1ldGEuZW52LkFQUF9WRVJTSU9OJzogSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24udmVyc2lvbiksXHJcbiAgICAnaW1wb3J0Lm1ldGEuZW52LkFQUF9CVUlMRF9IQVNIJzogSlNPTi5zdHJpbmdpZnkoYnVpbGRIYXNoKSxcclxuICAgICdpbXBvcnQubWV0YS5lbnYuQVBQX0RFUExPWV9JRCc6IEpTT04uc3RyaW5naWZ5KGJ1aWxkVGltZSksIC8vIElTTyB0aW1lc3RhbXAgYXMgZGVwbG95SWRcclxuXHJcbiAgICAvLyAzLiBTRVJWSUNFIFdPUktFUiBJTkpFQ1RJT05cclxuICAgICdfX1NXX1ZFUlNJT05fXyc6IEpTT04uc3RyaW5naWZ5KGAke3BhY2thZ2VKc29uLnZlcnNpb259XyR7YnVpbGRIYXNofWApLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIHtcclxuICAgICAgbmFtZTogJ2dlbmVyYXRlLXZlcnNpb24tanNvbicsXHJcbiAgICAgIC8vIFNlcnZlIHZpcnR1YWwgdmVyc2lvbi5qc29uIGluIERFVlxyXG4gICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICAgIGlmIChyZXEudXJsID09PSAnL3ZlcnNpb24uanNvbicgfHwgcmVxLnVybD8uc3RhcnRzV2l0aCgnL3ZlcnNpb24uanNvbj8nKSkge1xyXG4gICAgICAgICAgICBjb25zdCB2ZXJzaW9uSW5mbyA9IHtcclxuICAgICAgICAgICAgICBkZXBsb3lJZDogbmV3IERhdGUoKS50b0lTT1N0cmluZygpLFxyXG4gICAgICAgICAgICAgIGFwcFZlcnNpb246IHBhY2thZ2VKc29uLnZlcnNpb24sXHJcbiAgICAgICAgICAgICAgZW52aXJvbm1lbnQ6ICdkZXZlbG9wbWVudCcsXHJcbiAgICAgICAgICAgICAgYnVpbGRIYXNoOiAnZGV2XycgKyBEYXRlLm5vdygpLnRvU3RyaW5nKCkuc2xpY2UoLTYpXHJcbiAgICAgICAgICAgIH07XHJcbiAgICAgICAgICAgIHJlcy5zZXRIZWFkZXIoJ0NvbnRlbnQtVHlwZScsICdhcHBsaWNhdGlvbi9qc29uJyk7XHJcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkodmVyc2lvbkluZm8pKTtcclxuICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgbmV4dCgpO1xyXG4gICAgICAgIH0pO1xyXG4gICAgICB9LFxyXG4gICAgICBjbG9zZUJ1bmRsZSgpIHtcclxuICAgICAgICAvLyBHZW5lcmF0ZSB2ZXJzaW9uLmpzb24gZm9yIGNsaWVudC1zaWRlIGRlcGxveSB0cmFja2luZ1xyXG4gICAgICAgIGNvbnN0IHZlcnNpb25JbmZvID0ge1xyXG4gICAgICAgICAgZGVwbG95SWQ6IGJ1aWxkVGltZSwgLy8gSVNPIHRpbWVzdGFtcCBhcyBTU09UXHJcbiAgICAgICAgICBhcHBWZXJzaW9uOiBwYWNrYWdlSnNvbi52ZXJzaW9uLFxyXG4gICAgICAgICAgZW52aXJvbm1lbnQ6ICdwcm9kdWN0aW9uJyxcclxuICAgICAgICAgIGJ1aWxkSGFzaDogYnVpbGRIYXNoIC8vIE9wdGlvbmFsLCBmb3IgZGVidWdnaW5nXHJcbiAgICAgICAgfTtcclxuICAgICAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2Rpc3QnLCAndmVyc2lvbi5qc29uJyk7XHJcblxyXG4gICAgICAgIC8vIEVuc3VyZSBkaXN0IGV4aXN0cyAoaXQgc2hvdWxkIGFmdGVyIGJ1aWxkKVxyXG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0JykpKSB7XHJcbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIEpTT04uc3RyaW5naWZ5KHZlcnNpb25JbmZvLCBudWxsLCAyKSk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1ZpdGVdIEdlbmVyYXRlZCB2ZXJzaW9uLmpzb246IGRlcGxveUlkPSR7dmVyc2lvbkluZm8uZGVwbG95SWR9YCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHN0cmF0ZWdpZXM6ICdpbmplY3RNYW5pZmVzdCcsIC8vIFVzZSBjdXN0b20gU1dcclxuICAgICAgc3JjRGlyOiAnc3JjJyxcclxuICAgICAgZmlsZW5hbWU6ICdzdy50cycsIC8vIFNvdXJjZSBmaWxlIGlzIG5vdyBUU1xyXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJywgLy8gQXV0b21hdGljIHVwZGF0ZSBmbG93XHJcbiAgICAgIGluamVjdFJlZ2lzdGVyOiBudWxsLCAvLyBXZSByZWdpc3RlciBtYW51YWxseSBpbiBtYWluLnRzeFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ3JvYm90cy50eHQnXSxcclxuICAgICAgZGV2T3B0aW9uczoge1xyXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgdHlwZTogJ21vZHVsZScsIC8vIFJlcXVpcmVkIGZvciBzcmMvc3cuanMgaW4gZGV2XHJcbiAgICAgIH0sXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogJ1NhZmVTcG90JyxcclxuICAgICAgICBzaG9ydF9uYW1lOiAnU2FmZVNwb3QnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUGxhdGFmb3JtYSBjb211bml0YXJpYSBwYXJhIHJlcG9ydGFyIG9iamV0b3MgcGVyZGlkb3MgeSBlbmNvbnRyYWRvcycsXHJcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjMDBmZjg4JyxcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnIzAyMDYxNycsXHJcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxyXG4gICAgICAgIHN0YXJ0X3VybDogJy8nLFxyXG4gICAgICAgIC8vIEB0cy1pZ25vcmUgLSBSZXF1aXJlZCBmb3IgQ2hyb21lIFZBUElEL1B1c2ggY29tcGF0aWJpbGl0eVxyXG4gICAgICAgIGdjbV9zZW5kZXJfaWQ6IFwiMTAzOTUzODAwNTA3XCIsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMTkyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMTkyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSxcclxuICAgIH0sXHJcbiAgICBkZWR1cGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nLCAncmVhY3QtaGVsbWV0LWFzeW5jJ10sXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFtcclxuICAgICAgJ3JlYWN0JyxcclxuICAgICAgJ3JlYWN0LWRvbScsXHJcbiAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcclxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxyXG4gICAgICAnZnJhbWVyLW1vdGlvbicsXHJcbiAgICAgICdsdWNpZGUtcmVhY3QnLFxyXG4gICAgICAnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J1xyXG4gICAgXSxcclxuICAgIGV4Y2x1ZGU6IFtdLFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiA1MTc0LFxyXG4gICAgaG1yOiB7XHJcbiAgICAgIHByb3RvY29sOiAnd3MnLFxyXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcclxuICAgIH0sXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBiYXNlOiAnLycsXHJcbiAgYnVpbGQ6IHtcclxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxyXG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcclxuICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXHJcbiAgICBzb3VyY2VtYXA6IGZhbHNlLFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA1MDAsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgLy8gQ29yZSBSZWFjdCAtIGNoYW5nZXMgcmFyZWx5LCBoaWdoIGNhY2hlIHZhbHVlXHJcbiAgICAgICAgICAndmVuZG9yLXJlYWN0JzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbScsICdyZWFjdC1oZWxtZXQtYXN5bmMnXSxcclxuXHJcbiAgICAgICAgICAvLyBEYXRhIGxheWVyIC0gY2hhbmdlcyByYXJlbHlcclxuICAgICAgICAgICd2ZW5kb3ItcXVlcnknOiBbJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxyXG5cclxuICAgICAgICAgIC8vIFVJIGFuaW1hdGlvbnMgLSBtZWRpdW0gY2hhbmdlIGZyZXF1ZW5jeVxyXG4gICAgICAgICAgJ3ZlbmRvci11aSc6IFsnZnJhbWVyLW1vdGlvbicsICdsdWNpZGUtcmVhY3QnXSxcclxuXHJcbiAgICAgICAgICAvLyBNYXAgLSBsYXp5IGxvYWRlZCB2aWEgcm91dGUsIGxhcmdlIGJ1bmRsZVxyXG4gICAgICAgICAgJ3ZlbmRvci1tYXAnOiBbJ2xlYWZsZXQnLCAncmVhY3QtbGVhZmxldCcsICdyZWFjdC1sZWFmbGV0LWNsdXN0ZXInXSxcclxuXHJcbiAgICAgICAgICAvLyBSaWNoIHRleHQgZWRpdG9yIC0gbGF6eSBsb2FkZWQsIGxhcmdlIGJ1bmRsZVxyXG4gICAgICAgICAgJ3ZlbmRvci1lZGl0b3InOiBbXHJcbiAgICAgICAgICAgICdAdGlwdGFwL3JlYWN0JyxcclxuICAgICAgICAgICAgJ0B0aXB0YXAvc3RhcnRlci1raXQnLFxyXG4gICAgICAgICAgICAnQHRpcHRhcC9leHRlbnNpb24tbWVudGlvbicsXHJcbiAgICAgICAgICAgICdAdGlwdGFwL2V4dGVuc2lvbi1wbGFjZWhvbGRlcicsXHJcbiAgICAgICAgICAgICdAdGlwdGFwL2V4dGVuc2lvbi1jaGFyYWN0ZXItY291bnQnLFxyXG4gICAgICAgICAgICAnQHRpcHRhcC9leHRlbnNpb24tdW5kZXJsaW5lJyxcclxuICAgICAgICAgIF0sXHJcblxyXG4gICAgICAgICAgLy8gRm9ybSBoYW5kbGluZ1xyXG4gICAgICAgICAgJ3ZlbmRvci1mb3Jtcyc6IFsncmVhY3QtaG9vay1mb3JtJywgJ0Bob29rZm9ybS9yZXNvbHZlcnMnLCAnem9kJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSlcclxuIiwgIntcclxuICBcIm5hbWVcIjogXCJzYWZlc3BvdFwiLFxyXG4gIFwicHJpdmF0ZVwiOiB0cnVlLFxyXG4gIFwidmVyc2lvblwiOiBcIjIuNC4wLXByb1wiLFxyXG4gIFwidHlwZVwiOiBcIm1vZHVsZVwiLFxyXG4gIFwic2NyaXB0c1wiOiB7XHJcbiAgICBcImRldlwiOiBcInZpdGVcIixcclxuICAgIFwiYnVpbGRcIjogXCJ0c2MgJiYgdml0ZSBidWlsZFwiLFxyXG4gICAgXCJsaW50XCI6IFwiZXNsaW50IC4gLS1leHQgdHMsdHN4IC0tcmVwb3J0LXVudXNlZC1kaXNhYmxlLWRpcmVjdGl2ZXMgLS1tYXgtd2FybmluZ3MgMFwiLFxyXG4gICAgXCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXHJcbiAgICBcInRlc3RcIjogXCJ2aXRlc3RcIixcclxuICAgIFwidGVzdDp1bml0XCI6IFwidml0ZXN0IHJ1biB0ZXN0cy91bml0XCIsXHJcbiAgICBcInRlc3Q6aW50ZWdyYXRpb25cIjogXCJ2aXRlc3QgcnVuIHRlc3RzL2ludGVncmF0aW9uXCIsXHJcbiAgICBcInRlc3Q6Y29udHJhY3RcIjogXCJ2aXRlc3QgcnVuIHRlc3RzL2NvbnRyYWN0XCIsXHJcbiAgICBcInRlc3Q6ZTJlXCI6IFwicGxheXdyaWdodCB0ZXN0XCIsXHJcbiAgICBcInRlc3Q6YWxsXCI6IFwibnBtIHJ1biB0ZXN0OnVuaXQgJiYgbnBtIHJ1biB0ZXN0OmludGVncmF0aW9uICYmIG5wbSBydW4gdGVzdDpjb250cmFjdCAmJiBucG0gcnVuIHRlc3Q6ZTJlXCIsXHJcbiAgICBcInRlc3Q6cnVuXCI6IFwidml0ZXN0IHJ1blwiLFxyXG4gICAgXCJ0ZXN0OmNvdmVyYWdlXCI6IFwidml0ZXN0IHJ1biAtLWNvdmVyYWdlXCJcclxuICB9LFxyXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQGhvb2tmb3JtL3Jlc29sdmVyc1wiOiBcIl41LjIuMlwiLFxyXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiOiBcIl4yLjEuMTZcIixcclxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXN3aXRjaFwiOiBcIl4xLjIuNlwiLFxyXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcFwiOiBcIl4xLjIuOFwiLFxyXG4gICAgXCJAcmVhY3Qtb2F1dGgvZ29vZ2xlXCI6IFwiXjAuMTMuNFwiLFxyXG4gICAgXCJAc2VudHJ5L3JlYWN0XCI6IFwiXjEwLjM0LjBcIixcclxuICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCI6IFwiXjUuOTAuMTRcIixcclxuICAgIFwiQHRhbnN0YWNrL3JlYWN0LXZpcnR1YWxcIjogXCJeMy4xMy4xNFwiLFxyXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1jaGFyYWN0ZXItY291bnRcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLW1lbnRpb25cIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXBsYWNlaG9sZGVyXCI6IFwiXjMuMTQuMFwiLFxyXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi11bmRlcmxpbmVcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvcmVhY3RcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvc3RhcnRlci1raXRcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvc3VnZ2VzdGlvblwiOiBcIl4zLjE0LjBcIixcclxuICAgIFwiYnJvd3Nlci1pbWFnZS1jb21wcmVzc2lvblwiOiBcIl4yLjAuMlwiLFxyXG4gICAgXCJjYW52YXMtY29uZmV0dGlcIjogXCJeMS45LjRcIixcclxuICAgIFwiY2xzeFwiOiBcIl4yLjAuMFwiLFxyXG4gICAgXCJkYXRlLWZuc1wiOiBcIl40LjEuMFwiLFxyXG4gICAgXCJmcmFtZXItbW90aW9uXCI6IFwiXjEyLjIzLjI2XCIsXHJcbiAgICBcImxlYWZsZXRcIjogXCJeMS45LjRcIixcclxuICAgIFwibGVhZmxldC1nZXN0dXJlLWhhbmRsaW5nXCI6IFwiXjEuMi4yXCIsXHJcbiAgICBcImx1Y2lkZS1yZWFjdFwiOiBcIl4wLjI5NC4wXCIsXHJcbiAgICBcInJlYWN0XCI6IFwiMTguMi4wXCIsXHJcbiAgICBcInJlYWN0LWRvbVwiOiBcIjE4LjIuMFwiLFxyXG4gICAgXCJyZWFjdC1oZWxtZXQtYXN5bmNcIjogXCJeMi4wLjVcIixcclxuICAgIFwicmVhY3QtaG9vay1mb3JtXCI6IFwiXjcuNjkuMFwiLFxyXG4gICAgXCJyZWFjdC1qb3lyaWRlXCI6IFwiXjIuOS4zXCIsXHJcbiAgICBcInJlYWN0LWxlYWZsZXRcIjogXCJeNC4yLjFcIixcclxuICAgIFwicmVhY3QtbGVhZmxldC1jbHVzdGVyXCI6IFwiXjIuMS4wXCIsXHJcbiAgICBcInJlYWN0LW1hcmtkb3duXCI6IFwiXjkuMC4xXCIsXHJcbiAgICBcInJlYWN0LXJvdXRlci1kb21cIjogXCJeNi4yMC4wXCIsXHJcbiAgICBcInJlbWFyay1nZm1cIjogXCJeNC4wLjFcIixcclxuICAgIFwidGFpbHdpbmQtbWVyZ2VcIjogXCJeMi4wLjBcIixcclxuICAgIFwidGlwcHkuanNcIjogXCJeNi4zLjdcIixcclxuICAgIFwidXVpZFwiOiBcIl4xMy4wLjBcIixcclxuICAgIFwiem9kXCI6IFwiXjMuMjIuNFwiLFxyXG4gICAgXCJ6dXN0YW5kXCI6IFwiXjQuNC43XCJcclxuICB9LFxyXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQHBsYXl3cmlnaHQvdGVzdFwiOiBcIl4xLjU3LjBcIixcclxuICAgIFwiQHRlc3RpbmctbGlicmFyeS9qZXN0LWRvbVwiOiBcIl42LjkuMVwiLFxyXG4gICAgXCJAdGVzdGluZy1saWJyYXJ5L3JlYWN0XCI6IFwiXjE2LjMuMVwiLFxyXG4gICAgXCJAdHlwZXMvYmNyeXB0XCI6IFwiXjYuMC4wXCIsXHJcbiAgICBcIkB0eXBlcy9jYW52YXMtY29uZmV0dGlcIjogXCJeMS45LjBcIixcclxuICAgIFwiQHR5cGVzL2xlYWZsZXRcIjogXCJeMS45LjIxXCIsXHJcbiAgICBcIkB0eXBlcy9ub2RlXCI6IFwiXjI1LjAuM1wiLFxyXG4gICAgXCJAdHlwZXMvcmVhY3RcIjogXCJeMTguMi4zN1wiLFxyXG4gICAgXCJAdHlwZXMvcmVhY3QtZG9tXCI6IFwiXjE4LjIuMTVcIixcclxuICAgIFwiQHR5cGVzL3N1cGVydGVzdFwiOiBcIl42LjAuM1wiLFxyXG4gICAgXCJAdHlwZXMvdXVpZFwiOiBcIl4xMC4wLjBcIixcclxuICAgIFwiQHR5cGVzY3JpcHQtZXNsaW50L2VzbGludC1wbHVnaW5cIjogXCJeNi4xMC4wXCIsXHJcbiAgICBcIkB0eXBlc2NyaXB0LWVzbGludC9wYXJzZXJcIjogXCJeNi4xMC4wXCIsXHJcbiAgICBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI6IFwiXjQuMi4wXCIsXHJcbiAgICBcIkB2aXRlc3QvY292ZXJhZ2UtdjhcIjogXCJeNC4wLjE3XCIsXHJcbiAgICBcImF1dG9wcmVmaXhlclwiOiBcIl4xMC40LjE2XCIsXHJcbiAgICBcImVzbGludFwiOiBcIl44LjUzLjBcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi1sb2NhbC1ydWxlc1wiOiBcImZpbGU6ZXNsaW50LXJ1bGVzXCIsXHJcbiAgICBcImVzbGludC1wbHVnaW4tcmVhY3QtaG9va3NcIjogXCJeNC42LjBcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi1yZWFjdC1yZWZyZXNoXCI6IFwiXjAuNC40XCIsXHJcbiAgICBcImpzZG9tXCI6IFwiXjI3LjQuMFwiLFxyXG4gICAgXCJwb3N0Y3NzXCI6IFwiXjguNC4zMVwiLFxyXG4gICAgXCJzdXBlcnRlc3RcIjogXCJeNy4yLjJcIixcclxuICAgIFwidGFpbHdpbmRjc3NcIjogXCJeMy4zLjVcIixcclxuICAgIFwidHlwZXNjcmlwdFwiOiBcIl41LjIuMlwiLFxyXG4gICAgXCJ2aXRlXCI6IFwiXjUuMC4wXCIsXHJcbiAgICBcInZpdGUtcGx1Z2luLXB3YVwiOiBcIl4xLjIuMFwiLFxyXG4gICAgXCJ2aXRlc3RcIjogXCJeNC4wLjE3XCIsXHJcbiAgICBcIndvcmtib3gtd2luZG93XCI6IFwiXjcuNC4wXCJcclxuICB9LFxyXG4gIFwiZW5naW5lc1wiOiB7XHJcbiAgICBcIm5vZGVcIjogXCI+PTE4XCJcclxuICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUFtVixTQUFTLG9CQUFvQjtBQUNoWCxPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZSxXQUFXO0FBQ25DLE9BQU8sUUFBUTtBQUNmLE9BQU8sVUFBVTs7O0FDTGpCO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsRUFDWCxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsSUFDUixTQUFXO0FBQUEsSUFDWCxNQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYixvQkFBb0I7QUFBQSxJQUNwQixpQkFBaUI7QUFBQSxJQUNqQixZQUFZO0FBQUEsSUFDWixZQUFZO0FBQUEsSUFDWixZQUFZO0FBQUEsSUFDWixpQkFBaUI7QUFBQSxFQUNuQjtBQUFBLEVBQ0EsY0FBZ0I7QUFBQSxJQUNkLHVCQUF1QjtBQUFBLElBQ3ZCLGlDQUFpQztBQUFBLElBQ2pDLDBCQUEwQjtBQUFBLElBQzFCLDJCQUEyQjtBQUFBLElBQzNCLHVCQUF1QjtBQUFBLElBQ3ZCLGlCQUFpQjtBQUFBLElBQ2pCLHlCQUF5QjtBQUFBLElBQ3pCLDJCQUEyQjtBQUFBLElBQzNCLHFDQUFxQztBQUFBLElBQ3JDLDZCQUE2QjtBQUFBLElBQzdCLGlDQUFpQztBQUFBLElBQ2pDLCtCQUErQjtBQUFBLElBQy9CLGlCQUFpQjtBQUFBLElBQ2pCLHVCQUF1QjtBQUFBLElBQ3ZCLHNCQUFzQjtBQUFBLElBQ3RCLDZCQUE2QjtBQUFBLElBQzdC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
