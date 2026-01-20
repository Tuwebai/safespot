var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// vite.config.ts
import { defineConfig } from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/Usuario/Documents/Proyectos%20Web/Safespot/node_modules/vite-plugin-pwa/dist/index.js";
import { fileURLToPath, URL } from "node:url";

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
    // 2. ENTERPRISE VERSIONING (SSOT)
    "import.meta.env.APP_VERSION": JSON.stringify(package_default.version),
    "import.meta.env.APP_BUILD_HASH": JSON.stringify(buildHash),
    "import.meta.env.APP_BUILD_TIME": JSON.stringify(buildTime),
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
              version: package_default.version,
              buildHash: "dev_" + Date.now().toString().slice(-6),
              buildTime: (/* @__PURE__ */ new Date()).toISOString()
            };
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(versionInfo));
            return;
          }
          next();
        });
      },
      closeBundle() {
        const fs = __require("fs");
        const path = __require("path");
        const versionInfo = {
          version: package_default.version,
          buildHash,
          buildTime,
          severity: process.env.VITE_APP_VERSION_SEVERITY || "minor"
        };
        const outputPath = path.resolve(__vite_injected_original_dirname, "dist", "version.json");
        if (fs.existsSync(path.resolve(__vite_injected_original_dirname, "dist"))) {
          fs.writeFileSync(outputPath, JSON.stringify(versionInfo, null, 2));
          console.log(`[Vite] Generated version.json: v${versionInfo.version} (${versionInfo.buildHash})`);
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXN1YXJpb1xcXFxEb2N1bWVudHNcXFxcUHJveWVjdG9zIFdlYlxcXFxTYWZlc3BvdFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcVXN1YXJpb1xcXFxEb2N1bWVudHNcXFxcUHJveWVjdG9zIFdlYlxcXFxTYWZlc3BvdFxcXFx2aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vQzovVXNlcnMvVXN1YXJpby9Eb2N1bWVudHMvUHJveWVjdG9zJTIwV2ViL1NhZmVzcG90L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSAndml0ZSdcclxuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xyXG5pbXBvcnQgeyBWaXRlUFdBIH0gZnJvbSAndml0ZS1wbHVnaW4tcHdhJ1xyXG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoLCBVUkwgfSBmcm9tICdub2RlOnVybCdcclxuaW1wb3J0IHBhY2thZ2VKc29uIGZyb20gJy4vcGFja2FnZS5qc29uJ1xyXG5cclxuLy8gR2VuZXJhdGUgYSB1bmlxdWUgYnVpbGQgaGFzaCAoc2hvcnRlbmVkIHRpbWVzdGFtcCArIHZlcnNpb24gb3IgZ2l0IGhhc2ggaWYgYXZhaWxhYmxlKVxyXG5jb25zdCBidWlsZEhhc2ggPSBNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zdWJzdHJpbmcoMiwgOSk7XHJcbmNvbnN0IGJ1aWxkVGltZSA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKTtcclxuXHJcbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXHJcbmV4cG9ydCBkZWZhdWx0IGRlZmluZUNvbmZpZyh7XHJcbiAgZGVmaW5lOiB7XHJcbiAgICAvLyAxLiBTVEFOREFSRCBJTVBPUlRTXHJcbiAgICAnaW1wb3J0Lm1ldGEuZW52LlBBQ0tBR0VfVkVSU0lPTic6IEpTT04uc3RyaW5naWZ5KHBhY2thZ2VKc29uLnZlcnNpb24pLFxyXG5cclxuICAgIC8vIDIuIEVOVEVSUFJJU0UgVkVSU0lPTklORyAoU1NPVClcclxuICAgICdpbXBvcnQubWV0YS5lbnYuQVBQX1ZFUlNJT04nOiBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbi52ZXJzaW9uKSxcclxuICAgICdpbXBvcnQubWV0YS5lbnYuQVBQX0JVSUxEX0hBU0gnOiBKU09OLnN0cmluZ2lmeShidWlsZEhhc2gpLFxyXG4gICAgJ2ltcG9ydC5tZXRhLmVudi5BUFBfQlVJTERfVElNRSc6IEpTT04uc3RyaW5naWZ5KGJ1aWxkVGltZSksXHJcblxyXG4gICAgLy8gMy4gU0VSVklDRSBXT1JLRVIgSU5KRUNUSU9OXHJcbiAgICAnX19TV19WRVJTSU9OX18nOiBKU09OLnN0cmluZ2lmeShgJHtwYWNrYWdlSnNvbi52ZXJzaW9ufV8ke2J1aWxkSGFzaH1gKSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICB7XHJcbiAgICAgIG5hbWU6ICdnZW5lcmF0ZS12ZXJzaW9uLWpzb24nLFxyXG4gICAgICAvLyBTZXJ2ZSB2aXJ0dWFsIHZlcnNpb24uanNvbiBpbiBERVZcclxuICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xyXG4gICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgICBpZiAocmVxLnVybCA9PT0gJy92ZXJzaW9uLmpzb24nIHx8IHJlcS51cmw/LnN0YXJ0c1dpdGgoJy92ZXJzaW9uLmpzb24/JykpIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbkluZm8gPSB7XHJcbiAgICAgICAgICAgICAgdmVyc2lvbjogcGFja2FnZUpzb24udmVyc2lvbixcclxuICAgICAgICAgICAgICBidWlsZEhhc2g6ICdkZXZfJyArIERhdGUubm93KCkudG9TdHJpbmcoKS5zbGljZSgtNiksXHJcbiAgICAgICAgICAgICAgYnVpbGRUaW1lOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKClcclxuICAgICAgICAgICAgfTtcclxuICAgICAgICAgICAgcmVzLnNldEhlYWRlcignQ29udGVudC1UeXBlJywgJ2FwcGxpY2F0aW9uL2pzb24nKTtcclxuICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh2ZXJzaW9uSW5mbykpO1xyXG4gICAgICAgICAgICByZXR1cm47XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgICBuZXh0KCk7XHJcbiAgICAgICAgfSk7XHJcbiAgICAgIH0sXHJcbiAgICAgIGNsb3NlQnVuZGxlKCkge1xyXG4gICAgICAgIC8vIEdlbmVyYXRlIHZlcnNpb24uanNvbiBmb3IgY2xpZW50LXNpZGUgcG9sbGluZ1xyXG4gICAgICAgIGNvbnN0IGZzID0gcmVxdWlyZSgnZnMnKTtcclxuICAgICAgICBjb25zdCBwYXRoID0gcmVxdWlyZSgncGF0aCcpO1xyXG4gICAgICAgIGNvbnN0IHZlcnNpb25JbmZvID0ge1xyXG4gICAgICAgICAgdmVyc2lvbjogcGFja2FnZUpzb24udmVyc2lvbixcclxuICAgICAgICAgIGJ1aWxkSGFzaDogYnVpbGRIYXNoLFxyXG4gICAgICAgICAgYnVpbGRUaW1lOiBidWlsZFRpbWUsXHJcbiAgICAgICAgICBzZXZlcml0eTogcHJvY2Vzcy5lbnYuVklURV9BUFBfVkVSU0lPTl9TRVZFUklUWSB8fCAnbWlub3InXHJcbiAgICAgICAgfTtcclxuICAgICAgICBjb25zdCBvdXRwdXRQYXRoID0gcGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgJ2Rpc3QnLCAndmVyc2lvbi5qc29uJyk7XHJcblxyXG4gICAgICAgIC8vIEVuc3VyZSBkaXN0IGV4aXN0cyAoaXQgc2hvdWxkIGFmdGVyIGJ1aWxkKVxyXG4gICAgICAgIGlmIChmcy5leGlzdHNTeW5jKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0JykpKSB7XHJcbiAgICAgICAgICBmcy53cml0ZUZpbGVTeW5jKG91dHB1dFBhdGgsIEpTT04uc3RyaW5naWZ5KHZlcnNpb25JbmZvLCBudWxsLCAyKSk7XHJcbiAgICAgICAgICBjb25zb2xlLmxvZyhgW1ZpdGVdIEdlbmVyYXRlZCB2ZXJzaW9uLmpzb246IHYke3ZlcnNpb25JbmZvLnZlcnNpb259ICgke3ZlcnNpb25JbmZvLmJ1aWxkSGFzaH0pYCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9LFxyXG4gICAgVml0ZVBXQSh7XHJcbiAgICAgIHN0cmF0ZWdpZXM6ICdpbmplY3RNYW5pZmVzdCcsIC8vIFVzZSBjdXN0b20gU1dcclxuICAgICAgc3JjRGlyOiAnc3JjJyxcclxuICAgICAgZmlsZW5hbWU6ICdzdy50cycsIC8vIFNvdXJjZSBmaWxlIGlzIG5vdyBUU1xyXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJywgLy8gQXV0b21hdGljIHVwZGF0ZSBmbG93XHJcbiAgICAgIGluamVjdFJlZ2lzdGVyOiBudWxsLCAvLyBXZSByZWdpc3RlciBtYW51YWxseSBpbiBtYWluLnRzeFxyXG4gICAgICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ3JvYm90cy50eHQnXSxcclxuICAgICAgZGV2T3B0aW9uczoge1xyXG4gICAgICAgIGVuYWJsZWQ6IHRydWUsXHJcbiAgICAgICAgdHlwZTogJ21vZHVsZScsIC8vIFJlcXVpcmVkIGZvciBzcmMvc3cuanMgaW4gZGV2XHJcbiAgICAgIH0sXHJcbiAgICAgIG1hbmlmZXN0OiB7XHJcbiAgICAgICAgbmFtZTogJ1NhZmVTcG90JyxcclxuICAgICAgICBzaG9ydF9uYW1lOiAnU2FmZVNwb3QnLFxyXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnUGxhdGFmb3JtYSBjb211bml0YXJpYSBwYXJhIHJlcG9ydGFyIG9iamV0b3MgcGVyZGlkb3MgeSBlbmNvbnRyYWRvcycsXHJcbiAgICAgICAgdGhlbWVfY29sb3I6ICcjMDBmZjg4JyxcclxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnIzAyMDYxNycsXHJcbiAgICAgICAgZGlzcGxheTogJ3N0YW5kYWxvbmUnLFxyXG4gICAgICAgIHN0YXJ0X3VybDogJy8nLFxyXG4gICAgICAgIC8vIEB0cy1pZ25vcmUgLSBSZXF1aXJlZCBmb3IgQ2hyb21lIFZBUElEL1B1c2ggY29tcGF0aWJpbGl0eVxyXG4gICAgICAgIGdjbV9zZW5kZXJfaWQ6IFwiMTAzOTUzODAwNTA3XCIsXHJcbiAgICAgICAgaWNvbnM6IFtcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMTkyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnMTkyeDE5MicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgc3JjOiAnL2ljb25zL2ljb24tMTkyLnBuZycsXHJcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXHJcbiAgICAgICAgICAgIHR5cGU6ICdpbWFnZS9wbmcnLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICBdLFxyXG4gICAgICB9LFxyXG4gICAgfSksXHJcbiAgXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICAnQCc6IGZpbGVVUkxUb1BhdGgobmV3IFVSTCgnLi9zcmMnLCBpbXBvcnQubWV0YS51cmwpKSxcclxuICAgIH0sXHJcbiAgICBkZWR1cGU6IFsncmVhY3QnLCAncmVhY3QtZG9tJywgJ3JlYWN0LXJvdXRlci1kb20nLCAncmVhY3QtaGVsbWV0LWFzeW5jJ10sXHJcbiAgfSxcclxuICBvcHRpbWl6ZURlcHM6IHtcclxuICAgIGluY2x1ZGU6IFtcclxuICAgICAgJ3JlYWN0JyxcclxuICAgICAgJ3JlYWN0LWRvbScsXHJcbiAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcclxuICAgICAgJ3JlYWN0LXJvdXRlci1kb20nLFxyXG4gICAgICAnZnJhbWVyLW1vdGlvbicsXHJcbiAgICAgICdsdWNpZGUtcmVhY3QnLFxyXG4gICAgICAnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J1xyXG4gICAgXSxcclxuICAgIGV4Y2x1ZGU6IFtdLFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBwb3J0OiA1MTc0LFxyXG4gICAgaG1yOiB7XHJcbiAgICAgIHByb3RvY29sOiAnd3MnLFxyXG4gICAgICBob3N0OiAnbG9jYWxob3N0JyxcclxuICAgIH0sXHJcbiAgICBwcm94eToge1xyXG4gICAgICAnL2FwaSc6IHtcclxuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnLFxyXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcclxuICAgICAgICBzZWN1cmU6IGZhbHNlLFxyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfSxcclxuICBiYXNlOiAnLycsXHJcbiAgYnVpbGQ6IHtcclxuICAgIGVtcHR5T3V0RGlyOiB0cnVlLFxyXG4gICAgdGFyZ2V0OiAnZXMyMDIwJyxcclxuICAgIGFzc2V0c0RpcjogJ2Fzc2V0cycsXHJcbiAgICBzb3VyY2VtYXA6IGZhbHNlLFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA1MDAsXHJcbiAgICByb2xsdXBPcHRpb25zOiB7XHJcbiAgICAgIG91dHB1dDoge1xyXG4gICAgICAgIG1hbnVhbENodW5rczoge1xyXG4gICAgICAgICAgLy8gQ29yZSBSZWFjdCAtIGNoYW5nZXMgcmFyZWx5LCBoaWdoIGNhY2hlIHZhbHVlXHJcbiAgICAgICAgICAndmVuZG9yLXJlYWN0JzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbScsICdyZWFjdC1oZWxtZXQtYXN5bmMnXSxcclxuXHJcbiAgICAgICAgICAvLyBEYXRhIGxheWVyIC0gY2hhbmdlcyByYXJlbHlcclxuICAgICAgICAgICd2ZW5kb3ItcXVlcnknOiBbJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSddLFxyXG5cclxuICAgICAgICAgIC8vIFVJIGFuaW1hdGlvbnMgLSBtZWRpdW0gY2hhbmdlIGZyZXF1ZW5jeVxyXG4gICAgICAgICAgJ3ZlbmRvci11aSc6IFsnZnJhbWVyLW1vdGlvbicsICdsdWNpZGUtcmVhY3QnXSxcclxuXHJcbiAgICAgICAgICAvLyBNYXAgLSBsYXp5IGxvYWRlZCB2aWEgcm91dGUsIGxhcmdlIGJ1bmRsZVxyXG4gICAgICAgICAgJ3ZlbmRvci1tYXAnOiBbJ2xlYWZsZXQnLCAncmVhY3QtbGVhZmxldCcsICdyZWFjdC1sZWFmbGV0LWNsdXN0ZXInXSxcclxuXHJcbiAgICAgICAgICAvLyBSaWNoIHRleHQgZWRpdG9yIC0gbGF6eSBsb2FkZWQsIGxhcmdlIGJ1bmRsZVxyXG4gICAgICAgICAgJ3ZlbmRvci1lZGl0b3InOiBbXHJcbiAgICAgICAgICAgICdAdGlwdGFwL3JlYWN0JyxcclxuICAgICAgICAgICAgJ0B0aXB0YXAvc3RhcnRlci1raXQnLFxyXG4gICAgICAgICAgICAnQHRpcHRhcC9leHRlbnNpb24tbWVudGlvbicsXHJcbiAgICAgICAgICAgICdAdGlwdGFwL2V4dGVuc2lvbi1wbGFjZWhvbGRlcicsXHJcbiAgICAgICAgICAgICdAdGlwdGFwL2V4dGVuc2lvbi1jaGFyYWN0ZXItY291bnQnLFxyXG4gICAgICAgICAgICAnQHRpcHRhcC9leHRlbnNpb24tdW5kZXJsaW5lJyxcclxuICAgICAgICAgIF0sXHJcblxyXG4gICAgICAgICAgLy8gRm9ybSBoYW5kbGluZ1xyXG4gICAgICAgICAgJ3ZlbmRvci1mb3Jtcyc6IFsncmVhY3QtaG9vay1mb3JtJywgJ0Bob29rZm9ybS9yZXNvbHZlcnMnLCAnem9kJ10sXHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIH0sXHJcbiAgfSxcclxufSlcclxuIiwgIntcclxuICBcIm5hbWVcIjogXCJzYWZlc3BvdFwiLFxyXG4gIFwicHJpdmF0ZVwiOiB0cnVlLFxyXG4gIFwidmVyc2lvblwiOiBcIjIuNC4wLXByb1wiLFxyXG4gIFwidHlwZVwiOiBcIm1vZHVsZVwiLFxyXG4gIFwic2NyaXB0c1wiOiB7XHJcbiAgICBcImRldlwiOiBcInZpdGVcIixcclxuICAgIFwiYnVpbGRcIjogXCJ0c2MgJiYgdml0ZSBidWlsZFwiLFxyXG4gICAgXCJsaW50XCI6IFwiZXNsaW50IC4gLS1leHQgdHMsdHN4IC0tcmVwb3J0LXVudXNlZC1kaXNhYmxlLWRpcmVjdGl2ZXMgLS1tYXgtd2FybmluZ3MgMFwiLFxyXG4gICAgXCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXHJcbiAgICBcInRlc3RcIjogXCJ2aXRlc3RcIixcclxuICAgIFwidGVzdDp1bml0XCI6IFwidml0ZXN0IHJ1biB0ZXN0cy91bml0XCIsXHJcbiAgICBcInRlc3Q6aW50ZWdyYXRpb25cIjogXCJ2aXRlc3QgcnVuIHRlc3RzL2ludGVncmF0aW9uXCIsXHJcbiAgICBcInRlc3Q6Y29udHJhY3RcIjogXCJ2aXRlc3QgcnVuIHRlc3RzL2NvbnRyYWN0XCIsXHJcbiAgICBcInRlc3Q6ZTJlXCI6IFwicGxheXdyaWdodCB0ZXN0XCIsXHJcbiAgICBcInRlc3Q6YWxsXCI6IFwibnBtIHJ1biB0ZXN0OnVuaXQgJiYgbnBtIHJ1biB0ZXN0OmludGVncmF0aW9uICYmIG5wbSBydW4gdGVzdDpjb250cmFjdCAmJiBucG0gcnVuIHRlc3Q6ZTJlXCIsXHJcbiAgICBcInRlc3Q6cnVuXCI6IFwidml0ZXN0IHJ1blwiLFxyXG4gICAgXCJ0ZXN0OmNvdmVyYWdlXCI6IFwidml0ZXN0IHJ1biAtLWNvdmVyYWdlXCJcclxuICB9LFxyXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQGhvb2tmb3JtL3Jlc29sdmVyc1wiOiBcIl41LjIuMlwiLFxyXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiOiBcIl4yLjEuMTZcIixcclxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXN3aXRjaFwiOiBcIl4xLjIuNlwiLFxyXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcFwiOiBcIl4xLjIuOFwiLFxyXG4gICAgXCJAcmVhY3Qtb2F1dGgvZ29vZ2xlXCI6IFwiXjAuMTMuNFwiLFxyXG4gICAgXCJAc2VudHJ5L3JlYWN0XCI6IFwiXjEwLjM0LjBcIixcclxuICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCI6IFwiXjUuOTAuMTRcIixcclxuICAgIFwiQHRhbnN0YWNrL3JlYWN0LXZpcnR1YWxcIjogXCJeMy4xMy4xNFwiLFxyXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1jaGFyYWN0ZXItY291bnRcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLW1lbnRpb25cIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXBsYWNlaG9sZGVyXCI6IFwiXjMuMTQuMFwiLFxyXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi11bmRlcmxpbmVcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvcmVhY3RcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvc3RhcnRlci1raXRcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvc3VnZ2VzdGlvblwiOiBcIl4zLjE0LjBcIixcclxuICAgIFwiYnJvd3Nlci1pbWFnZS1jb21wcmVzc2lvblwiOiBcIl4yLjAuMlwiLFxyXG4gICAgXCJjYW52YXMtY29uZmV0dGlcIjogXCJeMS45LjRcIixcclxuICAgIFwiY2xzeFwiOiBcIl4yLjAuMFwiLFxyXG4gICAgXCJkYXRlLWZuc1wiOiBcIl40LjEuMFwiLFxyXG4gICAgXCJmcmFtZXItbW90aW9uXCI6IFwiXjEyLjIzLjI2XCIsXHJcbiAgICBcImxlYWZsZXRcIjogXCJeMS45LjRcIixcclxuICAgIFwibGVhZmxldC1nZXN0dXJlLWhhbmRsaW5nXCI6IFwiXjEuMi4yXCIsXHJcbiAgICBcImx1Y2lkZS1yZWFjdFwiOiBcIl4wLjI5NC4wXCIsXHJcbiAgICBcInJlYWN0XCI6IFwiMTguMi4wXCIsXHJcbiAgICBcInJlYWN0LWRvbVwiOiBcIjE4LjIuMFwiLFxyXG4gICAgXCJyZWFjdC1oZWxtZXQtYXN5bmNcIjogXCJeMi4wLjVcIixcclxuICAgIFwicmVhY3QtaG9vay1mb3JtXCI6IFwiXjcuNjkuMFwiLFxyXG4gICAgXCJyZWFjdC1qb3lyaWRlXCI6IFwiXjIuOS4zXCIsXHJcbiAgICBcInJlYWN0LWxlYWZsZXRcIjogXCJeNC4yLjFcIixcclxuICAgIFwicmVhY3QtbGVhZmxldC1jbHVzdGVyXCI6IFwiXjIuMS4wXCIsXHJcbiAgICBcInJlYWN0LW1hcmtkb3duXCI6IFwiXjkuMC4xXCIsXHJcbiAgICBcInJlYWN0LXJvdXRlci1kb21cIjogXCJeNi4yMC4wXCIsXHJcbiAgICBcInJlbWFyay1nZm1cIjogXCJeNC4wLjFcIixcclxuICAgIFwidGFpbHdpbmQtbWVyZ2VcIjogXCJeMi4wLjBcIixcclxuICAgIFwidGlwcHkuanNcIjogXCJeNi4zLjdcIixcclxuICAgIFwidXVpZFwiOiBcIl4xMy4wLjBcIixcclxuICAgIFwiem9kXCI6IFwiXjMuMjIuNFwiLFxyXG4gICAgXCJ6dXN0YW5kXCI6IFwiXjQuNC43XCJcclxuICB9LFxyXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQHBsYXl3cmlnaHQvdGVzdFwiOiBcIl4xLjU3LjBcIixcclxuICAgIFwiQHRlc3RpbmctbGlicmFyeS9qZXN0LWRvbVwiOiBcIl42LjkuMVwiLFxyXG4gICAgXCJAdGVzdGluZy1saWJyYXJ5L3JlYWN0XCI6IFwiXjE2LjMuMVwiLFxyXG4gICAgXCJAdHlwZXMvYmNyeXB0XCI6IFwiXjYuMC4wXCIsXHJcbiAgICBcIkB0eXBlcy9jYW52YXMtY29uZmV0dGlcIjogXCJeMS45LjBcIixcclxuICAgIFwiQHR5cGVzL2xlYWZsZXRcIjogXCJeMS45LjIxXCIsXHJcbiAgICBcIkB0eXBlcy9ub2RlXCI6IFwiXjI1LjAuM1wiLFxyXG4gICAgXCJAdHlwZXMvcmVhY3RcIjogXCJeMTguMi4zN1wiLFxyXG4gICAgXCJAdHlwZXMvcmVhY3QtZG9tXCI6IFwiXjE4LjIuMTVcIixcclxuICAgIFwiQHR5cGVzL3N1cGVydGVzdFwiOiBcIl42LjAuM1wiLFxyXG4gICAgXCJAdHlwZXMvdXVpZFwiOiBcIl4xMC4wLjBcIixcclxuICAgIFwiQHR5cGVzY3JpcHQtZXNsaW50L2VzbGludC1wbHVnaW5cIjogXCJeNi4xMC4wXCIsXHJcbiAgICBcIkB0eXBlc2NyaXB0LWVzbGludC9wYXJzZXJcIjogXCJeNi4xMC4wXCIsXHJcbiAgICBcIkB2aXRlanMvcGx1Z2luLXJlYWN0XCI6IFwiXjQuMi4wXCIsXHJcbiAgICBcIkB2aXRlc3QvY292ZXJhZ2UtdjhcIjogXCJeNC4wLjE3XCIsXHJcbiAgICBcImF1dG9wcmVmaXhlclwiOiBcIl4xMC40LjE2XCIsXHJcbiAgICBcImVzbGludFwiOiBcIl44LjUzLjBcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi1sb2NhbC1ydWxlc1wiOiBcImZpbGU6ZXNsaW50LXJ1bGVzXCIsXHJcbiAgICBcImVzbGludC1wbHVnaW4tcmVhY3QtaG9va3NcIjogXCJeNC42LjBcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi1yZWFjdC1yZWZyZXNoXCI6IFwiXjAuNC40XCIsXHJcbiAgICBcImpzZG9tXCI6IFwiXjI3LjQuMFwiLFxyXG4gICAgXCJwb3N0Y3NzXCI6IFwiXjguNC4zMVwiLFxyXG4gICAgXCJzdXBlcnRlc3RcIjogXCJeNy4yLjJcIixcclxuICAgIFwidGFpbHdpbmRjc3NcIjogXCJeMy4zLjVcIixcclxuICAgIFwidHlwZXNjcmlwdFwiOiBcIl41LjIuMlwiLFxyXG4gICAgXCJ2aXRlXCI6IFwiXjUuMC4wXCIsXHJcbiAgICBcInZpdGUtcGx1Z2luLXB3YVwiOiBcIl4xLjIuMFwiLFxyXG4gICAgXCJ2aXRlc3RcIjogXCJeNC4wLjE3XCIsXHJcbiAgICBcIndvcmtib3gtd2luZG93XCI6IFwiXjcuNC4wXCJcclxuICB9LFxyXG4gIFwiZW5naW5lc1wiOiB7XHJcbiAgICBcIm5vZGVcIjogXCI+PTE4XCJcclxuICB9XHJcbn1cclxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7QUFBbVYsU0FBUyxvQkFBb0I7QUFDaFgsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWUsV0FBVzs7O0FDSG5DO0FBQUEsRUFDRSxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsRUFDWCxTQUFXO0FBQUEsRUFDWCxNQUFRO0FBQUEsRUFDUixTQUFXO0FBQUEsSUFDVCxLQUFPO0FBQUEsSUFDUCxPQUFTO0FBQUEsSUFDVCxNQUFRO0FBQUEsSUFDUixTQUFXO0FBQUEsSUFDWCxNQUFRO0FBQUEsSUFDUixhQUFhO0FBQUEsSUFDYixvQkFBb0I7QUFBQSxJQUNwQixpQkFBaUI7QUFBQSxJQUNqQixZQUFZO0FBQUEsSUFDWixZQUFZO0FBQUEsSUFDWixZQUFZO0FBQUEsSUFDWixpQkFBaUI7QUFBQSxFQUNuQjtBQUFBLEVBQ0EsY0FBZ0I7QUFBQSxJQUNkLHVCQUF1QjtBQUFBLElBQ3ZCLGlDQUFpQztBQUFBLElBQ2pDLDBCQUEwQjtBQUFBLElBQzFCLDJCQUEyQjtBQUFBLElBQzNCLHVCQUF1QjtBQUFBLElBQ3ZCLGlCQUFpQjtBQUFBLElBQ2pCLHlCQUF5QjtBQUFBLElBQ3pCLDJCQUEyQjtBQUFBLElBQzNCLHFDQUFxQztBQUFBLElBQ3JDLDZCQUE2QjtBQUFBLElBQzdCLGlDQUFpQztBQUFBLElBQ2pDLCtCQUErQjtBQUFBLElBQy9CLGlCQUFpQjtBQUFBLElBQ2pCLHVCQUF1QjtBQUFBLElBQ3ZCLHNCQUFzQjtBQUFBLElBQ3RCLDZCQUE2QjtBQUFBLElBQzdCLG1CQUFtQjtBQUFBLElBQ25CLE1BQVE7QUFBQSxJQUNSLFlBQVk7QUFBQSxJQUNaLGlCQUFpQjtBQUFBLElBQ2pCLFNBQVc7QUFBQSxJQUNYLDRCQUE0QjtBQUFBLElBQzVCLGdC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
