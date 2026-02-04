// vite.config.ts
import { defineConfig } from "file:///C:/Users/juan/Documents/Proyectos/Safespot/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/juan/Documents/Proyectos/Safespot/node_modules/@vitejs/plugin-react/dist/index.js";
import { VitePWA } from "file:///C:/Users/juan/Documents/Proyectos/Safespot/node_modules/vite-plugin-pwa/dist/index.js";
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
    "@types/bcryptjs": "^2.4.6",
    bcryptjs: "^2.4.3",
    "@types/canvas-confetti": "^1.9.0",
    "@types/jsonwebtoken": "^9.0.10",
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
    dotenv: "^17.2.3",
    eslint: "^8.53.0",
    "eslint-plugin-local-rules": "file:eslint-rules",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.4",
    jsdom: "^27.4.0",
    jsonwebtoken: "^9.0.3",
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
  },
  include: [
    "src",
    "tests"
  ]
};

// vite.config.ts
import jwt from "file:///C:/Users/juan/Documents/Proyectos/Safespot/node_modules/jsonwebtoken/index.js";
import dotenv from "file:///C:/Users/juan/Documents/Proyectos/Safespot/node_modules/dotenv/lib/main.js";
var __vite_injected_original_import_meta_url = "file:///C:/Users/juan/Documents/Proyectos/Safespot/vite.config.ts";
var __dirname = path.dirname(fileURLToPath(__vite_injected_original_import_meta_url));
var envPath = path.resolve(__dirname, "server", ".env");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`[SECURITY] server/.env not found at ${envPath}. Ensure backend exists.`);
}
var JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET || JWT_SECRET === "super-secret-jwt-key-change-this") {
  console.error("\u274C [SECURITY] CRITICAL: JWT_SECRET is missing or insecure! Blocking admin access.");
}
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
    "__SW_VERSION__": JSON.stringify(`${package_default.version}_${buildHash}`),
    "__API_BASE_URL__": JSON.stringify((process.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "").endsWith("/api") ? (process.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "") : `${(process.env.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "")}/api`)
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
        const outputPath = path.resolve(__dirname, "dist", "version.json");
        if (fs.existsSync(path.resolve(__dirname, "dist"))) {
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
        // @ts-expect-error - Required for Chrome VAPID/Push compatibility
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
    }),
    {
      name: "admin-zero-trust-loader",
      // 1. 🛡️ DEV GATEWAY: Intercept admin assets in the Vite dev server
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || "";
          if (url.startsWith("/admin") && !url.includes(".")) {
            req.url = "/admin.html";
            return next();
          }
          const isInternalAdmin = url.includes("/src/admin/");
          if (isInternalAdmin) {
            const isAsset = url.includes(".tsx") || url.includes(".ts") || url.includes(".jsx") || url.includes(".js") || url.includes(".css") || url.includes(".json") || url.includes(".map") || url.includes("node_modules") || url.includes("/@vite/") || url.includes("?t=");
            if (isAsset) {
              const parsedUrl2 = new URL(url, "http://localhost");
              const tParam = parsedUrl2.searchParams.get("t");
              if (tParam && (tParam.length > 50 || tParam.startsWith("ey"))) {
                parsedUrl2.searchParams.delete("t");
                req.url = parsedUrl2.pathname + parsedUrl2.search;
              }
              return next();
            }
            const parsedUrl = new URL(url, "http://localhost");
            const queryToken = parsedUrl.searchParams.get("t");
            const cookieToken = req.headers.cookie?.split("; ").find((row) => row.startsWith("admin_jwt="))?.split("=")[1];
            const token = queryToken || cookieToken;
            if (!token) {
              console.warn(`[SECURITY] Golden Rule Interception: Blocked internal asset ${url} (Missing Token)`);
              res.statusCode = 401;
              res.end("Unauthorized: Admin Internal Assets require a valid Security Token.");
              return;
            }
            try {
              const decoded = jwt.verify(token, JWT_SECRET);
              if (decoded.role !== "admin" && decoded.role !== "super_admin") {
                console.warn(`[SECURITY] Golden Rule Interception: Blocked internal asset ${url} (Insufficient Permissions: ${decoded.role})`);
                res.statusCode = 403;
                res.end("Forbidden: Admin Authority Required.");
                return;
              }
              if (queryToken) {
                res.setHeader("Set-Cookie", `admin_jwt=${queryToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
                parsedUrl.searchParams.delete("t");
                req.url = parsedUrl.pathname + parsedUrl.search;
              }
            } catch (err) {
              console.warn(`[SECURITY] Golden Rule Interception: Blocked internal asset ${url} (Invalid/Forged Token: ${err.message})`);
              res.statusCode = 401;
              res.end("Unauthorized: Invalid or Expired Security Token.");
              return;
            }
          }
          next();
        });
      },
      // 2. ⚡ PROD RESOLVER: Inject hashed paths into the dynamic loader
      transformIndexHtml: {
        order: "post",
        handler(html, ctx) {
          if (!ctx.filename.endsWith("admin.html")) return html;
          if (!ctx.bundle) return html;
          const adminEntry = Object.values(ctx.bundle).find((f) => f.name === "admin" && f.type === "chunk");
          const loginEntry = Object.values(ctx.bundle).find((f) => f.name === "admin_login" && f.type === "chunk");
          return html.replace("/src/admin/entry.tsx", `/admin-assets/internal/${adminEntry?.fileName || ""}`).replace("/src/admin-login.tsx", `/admin-assets/public/${loginEntry?.fileName || ""}`);
        }
      }
    }
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
      input: {
        main: path.resolve(__dirname, "index.html"),
        admin: path.resolve(__dirname, "admin.html"),
        admin_login: path.resolve(__dirname, "src/admin-login.tsx"),
        admin_internal: path.resolve(__dirname, "src/admin/entry.tsx")
      },
      output: {
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name.toLowerCase();
          const isInternalAdmin = chunkInfo.facadeModuleId?.includes("/src/admin/");
          if (isInternalAdmin || name.includes("admin_internal")) {
            return "admin-assets/internal/[name]-[hash].js";
          }
          if (name.includes("admin_login") || name.includes("adminlogin")) {
            return "admin-assets/public/[name]-[hash].js";
          }
          if (name.includes("admin")) {
            return "admin-assets/internal/[name]-[hash].js";
          }
          return "assets/[name]-[hash].js";
        },
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === "admin") {
            return "admin-assets/internal/admin-entry-[hash].js";
          }
          if (chunkInfo.name === "admin_login") {
            return "admin-assets/public/login-entry-[hash].js";
          }
          return "assets/[name]-[hash].js";
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name?.toLowerCase() || "";
          if (name.includes("admin")) {
            if (name.includes("login")) return "admin-assets/public/[name]-[hash][extname]";
            return "admin-assets/internal/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
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
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiLCAicGFja2FnZS5qc29uIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyJjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZGlybmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcanVhblxcXFxEb2N1bWVudHNcXFxcUHJveWVjdG9zXFxcXFNhZmVzcG90XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxqdWFuXFxcXERvY3VtZW50c1xcXFxQcm95ZWN0b3NcXFxcU2FmZXNwb3RcXFxcdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2p1YW4vRG9jdW1lbnRzL1Byb3llY3Rvcy9TYWZlc3BvdC92aXRlLmNvbmZpZy50c1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gJ3ZpdGUnXHJcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdCdcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSdcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSAnbm9kZTp1cmwnXHJcbmltcG9ydCBmcyBmcm9tICdub2RlOmZzJ1xyXG5pbXBvcnQgcGF0aCBmcm9tICdub2RlOnBhdGgnXHJcbmltcG9ydCBwYWNrYWdlSnNvbiBmcm9tICcuL3BhY2thZ2UuanNvbidcclxuaW1wb3J0IGp3dCBmcm9tICdqc29ud2VidG9rZW4nXHJcbmltcG9ydCBkb3RlbnYgZnJvbSAnZG90ZW52J1xyXG5cclxuLy8gXHUyNzA1IEVOVEVSUFJJU0U6IFNlY3VyZSBFbnZpcm9ubWVudCBMb2FkaW5nIChFU00gY29tcGF0aWJsZSlcclxuY29uc3QgX19kaXJuYW1lID0gcGF0aC5kaXJuYW1lKGZpbGVVUkxUb1BhdGgoaW1wb3J0Lm1ldGEudXJsKSk7XHJcbmNvbnN0IGVudlBhdGggPSBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc2VydmVyJywgJy5lbnYnKTtcclxuXHJcbmlmIChmcy5leGlzdHNTeW5jKGVudlBhdGgpKSB7XHJcbiAgZG90ZW52LmNvbmZpZyh7IHBhdGg6IGVudlBhdGggfSk7XHJcbn0gZWxzZSB7XHJcbiAgY29uc29sZS53YXJuKGBbU0VDVVJJVFldIHNlcnZlci8uZW52IG5vdCBmb3VuZCBhdCAke2VudlBhdGh9LiBFbnN1cmUgYmFja2VuZCBleGlzdHMuYCk7XHJcbn1cclxuXHJcbmNvbnN0IEpXVF9TRUNSRVQgPSBwcm9jZXNzLmVudi5KV1RfU0VDUkVUO1xyXG5cclxuaWYgKCFKV1RfU0VDUkVUIHx8IEpXVF9TRUNSRVQgPT09ICdzdXBlci1zZWNyZXQtand0LWtleS1jaGFuZ2UtdGhpcycpIHtcclxuICBjb25zb2xlLmVycm9yKCdcdTI3NEMgW1NFQ1VSSVRZXSBDUklUSUNBTDogSldUX1NFQ1JFVCBpcyBtaXNzaW5nIG9yIGluc2VjdXJlISBCbG9ja2luZyBhZG1pbiBhY2Nlc3MuJyk7XHJcbn1cclxuXHJcblxyXG4vLyBHZW5lcmF0ZSBhIHVuaXF1ZSBidWlsZCBoYXNoIChzaG9ydGVuZWQgdGltZXN0YW1wICsgdmVyc2lvbiBvciBnaXQgaGFzaCBpZiBhdmFpbGFibGUpXHJcbmNvbnN0IGJ1aWxkSGFzaCA9IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnN1YnN0cmluZygyLCA5KTtcclxuY29uc3QgYnVpbGRUaW1lID0gbmV3IERhdGUoKS50b0lTT1N0cmluZygpO1xyXG5cclxuLy8gaHR0cHM6Ly92aXRlanMuZGV2L2NvbmZpZy9cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBkZWZpbmU6IHtcclxuICAgIC8vIDEuIFNUQU5EQVJEIElNUE9SVFNcclxuICAgICdpbXBvcnQubWV0YS5lbnYuUEFDS0FHRV9WRVJTSU9OJzogSlNPTi5zdHJpbmdpZnkocGFja2FnZUpzb24udmVyc2lvbiksXHJcblxyXG4gICAgLy8gMi4gRU5URVJQUklTRSBWRVJTSU9OSU5HIChTU09UOiBkZXBsb3lJZClcclxuICAgICdpbXBvcnQubWV0YS5lbnYuQVBQX1ZFUlNJT04nOiBKU09OLnN0cmluZ2lmeShwYWNrYWdlSnNvbi52ZXJzaW9uKSxcclxuICAgICdpbXBvcnQubWV0YS5lbnYuQVBQX0JVSUxEX0hBU0gnOiBKU09OLnN0cmluZ2lmeShidWlsZEhhc2gpLFxyXG4gICAgJ2ltcG9ydC5tZXRhLmVudi5BUFBfREVQTE9ZX0lEJzogSlNPTi5zdHJpbmdpZnkoYnVpbGRUaW1lKSwgLy8gSVNPIHRpbWVzdGFtcCBhcyBkZXBsb3lJZFxyXG5cclxuICAgIC8vIDMuIFNFUlZJQ0UgV09SS0VSIElOSkVDVElPTlxyXG4gICAgJ19fU1dfVkVSU0lPTl9fJzogSlNPTi5zdHJpbmdpZnkoYCR7cGFja2FnZUpzb24udmVyc2lvbn1fJHtidWlsZEhhc2h9YCksXHJcbiAgICAnX19BUElfQkFTRV9VUkxfXyc6IEpTT04uc3RyaW5naWZ5KChwcm9jZXNzLmVudi5WSVRFX0FQSV9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcpLnJlcGxhY2UoL1xcLyQvLCAnJykuZW5kc1dpdGgoJy9hcGknKVxyXG4gICAgICA/IChwcm9jZXNzLmVudi5WSVRFX0FQSV9VUkwgfHwgJ2h0dHA6Ly9sb2NhbGhvc3Q6MzAwMCcpLnJlcGxhY2UoL1xcLyQvLCAnJylcclxuICAgICAgOiBgJHsocHJvY2Vzcy5lbnYuVklURV9BUElfVVJMIHx8ICdodHRwOi8vbG9jYWxob3N0OjMwMDAnKS5yZXBsYWNlKC9cXC8kLywgJycpfS9hcGlgKSxcclxuICB9LFxyXG4gIHBsdWdpbnM6IFtcclxuICAgIHJlYWN0KCksXHJcbiAgICB7XHJcbiAgICAgIG5hbWU6ICdnZW5lcmF0ZS12ZXJzaW9uLWpzb24nLFxyXG4gICAgICAvLyBTZXJ2ZSB2aXJ0dWFsIHZlcnNpb24uanNvbiBpbiBERVZcclxuICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xyXG4gICAgICAgIHNlcnZlci5taWRkbGV3YXJlcy51c2UoKHJlcSwgcmVzLCBuZXh0KSA9PiB7XHJcbiAgICAgICAgICBpZiAocmVxLnVybCA9PT0gJy92ZXJzaW9uLmpzb24nIHx8IHJlcS51cmw/LnN0YXJ0c1dpdGgoJy92ZXJzaW9uLmpzb24/JykpIHtcclxuICAgICAgICAgICAgY29uc3QgdmVyc2lvbkluZm8gPSB7XHJcbiAgICAgICAgICAgICAgZGVwbG95SWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcclxuICAgICAgICAgICAgICBhcHBWZXJzaW9uOiBwYWNrYWdlSnNvbi52ZXJzaW9uLFxyXG4gICAgICAgICAgICAgIGVudmlyb25tZW50OiAnZGV2ZWxvcG1lbnQnLFxyXG4gICAgICAgICAgICAgIGJ1aWxkSGFzaDogJ2Rldl8nICsgRGF0ZS5ub3coKS50b1N0cmluZygpLnNsaWNlKC02KVxyXG4gICAgICAgICAgICB9O1xyXG4gICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdDb250ZW50LVR5cGUnLCAnYXBwbGljYXRpb24vanNvbicpO1xyXG4gICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHZlcnNpb25JbmZvKSk7XHJcbiAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIG5leHQoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSxcclxuICAgICAgY2xvc2VCdW5kbGUoKSB7XHJcbiAgICAgICAgLy8gR2VuZXJhdGUgdmVyc2lvbi5qc29uIGZvciBjbGllbnQtc2lkZSBkZXBsb3kgdHJhY2tpbmdcclxuICAgICAgICBjb25zdCB2ZXJzaW9uSW5mbyA9IHtcclxuICAgICAgICAgIGRlcGxveUlkOiBidWlsZFRpbWUsIC8vIElTTyB0aW1lc3RhbXAgYXMgU1NPVFxyXG4gICAgICAgICAgYXBwVmVyc2lvbjogcGFja2FnZUpzb24udmVyc2lvbixcclxuICAgICAgICAgIGVudmlyb25tZW50OiAncHJvZHVjdGlvbicsXHJcbiAgICAgICAgICBidWlsZEhhc2g6IGJ1aWxkSGFzaCAvLyBPcHRpb25hbCwgZm9yIGRlYnVnZ2luZ1xyXG4gICAgICAgIH07XHJcbiAgICAgICAgY29uc3Qgb3V0cHV0UGF0aCA9IHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsICdkaXN0JywgJ3ZlcnNpb24uanNvbicpO1xyXG5cclxuICAgICAgICAvLyBFbnN1cmUgZGlzdCBleGlzdHMgKGl0IHNob3VsZCBhZnRlciBidWlsZClcclxuICAgICAgICBpZiAoZnMuZXhpc3RzU3luYyhwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnZGlzdCcpKSkge1xyXG4gICAgICAgICAgZnMud3JpdGVGaWxlU3luYyhvdXRwdXRQYXRoLCBKU09OLnN0cmluZ2lmeSh2ZXJzaW9uSW5mbywgbnVsbCwgMikpO1xyXG4gICAgICAgICAgY29uc29sZS5sb2coYFtWaXRlXSBHZW5lcmF0ZWQgdmVyc2lvbi5qc29uOiBkZXBsb3lJZD0ke3ZlcnNpb25JbmZvLmRlcGxveUlkfWApO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSxcclxuICAgIFZpdGVQV0Eoe1xyXG4gICAgICBzdHJhdGVnaWVzOiAnaW5qZWN0TWFuaWZlc3QnLCAvLyBVc2UgY3VzdG9tIFNXXHJcbiAgICAgIHNyY0RpcjogJ3NyYycsXHJcbiAgICAgIGZpbGVuYW1lOiAnc3cudHMnLCAvLyBTb3VyY2UgZmlsZSBpcyBub3cgVFNcclxuICAgICAgcmVnaXN0ZXJUeXBlOiAnYXV0b1VwZGF0ZScsIC8vIEF1dG9tYXRpYyB1cGRhdGUgZmxvd1xyXG4gICAgICBpbmplY3RSZWdpc3RlcjogbnVsbCwgLy8gV2UgcmVnaXN0ZXIgbWFudWFsbHkgaW4gbWFpbi50c3hcclxuICAgICAgaW5jbHVkZUFzc2V0czogWydmYXZpY29uLmljbycsICdyb2JvdHMudHh0J10sXHJcbiAgICAgIGRldk9wdGlvbnM6IHtcclxuICAgICAgICBlbmFibGVkOiB0cnVlLFxyXG4gICAgICAgIHR5cGU6ICdtb2R1bGUnLCAvLyBSZXF1aXJlZCBmb3Igc3JjL3N3LmpzIGluIGRldlxyXG4gICAgICB9LFxyXG4gICAgICBtYW5pZmVzdDoge1xyXG4gICAgICAgIG5hbWU6ICdTYWZlU3BvdCcsXHJcbiAgICAgICAgc2hvcnRfbmFtZTogJ1NhZmVTcG90JyxcclxuICAgICAgICBkZXNjcmlwdGlvbjogJ1BsYXRhZm9ybWEgY29tdW5pdGFyaWEgcGFyYSByZXBvcnRhciBvYmpldG9zIHBlcmRpZG9zIHkgZW5jb250cmFkb3MnLFxyXG4gICAgICAgIHRoZW1lX2NvbG9yOiAnIzAwZmY4OCcsXHJcbiAgICAgICAgYmFja2dyb3VuZF9jb2xvcjogJyMwMjA2MTcnLFxyXG4gICAgICAgIGRpc3BsYXk6ICdzdGFuZGFsb25lJyxcclxuICAgICAgICBzdGFydF91cmw6ICcvJyxcclxuICAgICAgICAvLyBAdHMtZXhwZWN0LWVycm9yIC0gUmVxdWlyZWQgZm9yIENocm9tZSBWQVBJRC9QdXNoIGNvbXBhdGliaWxpdHlcclxuICAgICAgICBnY21fc2VuZGVyX2lkOiBcIjEwMzk1MzgwMDUwN1wiLFxyXG4gICAgICAgIGljb25zOiBbXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJy9pY29ucy9pY29uLTE5Mi5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIHNyYzogJy9pY29ucy9pY29uLTE5Mi5wbmcnLFxyXG4gICAgICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgXSxcclxuICAgICAgfSxcclxuICAgIH0pLFxyXG4gICAge1xyXG4gICAgICBuYW1lOiAnYWRtaW4temVyby10cnVzdC1sb2FkZXInLFxyXG4gICAgICAvLyAxLiBcdUQ4M0RcdURFRTFcdUZFMEYgREVWIEdBVEVXQVk6IEludGVyY2VwdCBhZG1pbiBhc3NldHMgaW4gdGhlIFZpdGUgZGV2IHNlcnZlclxyXG4gICAgICBjb25maWd1cmVTZXJ2ZXIoc2VydmVyKSB7XHJcbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZShhc3luYyAocmVxLCByZXMsIG5leHQpID0+IHtcclxuICAgICAgICAgIGNvbnN0IHVybCA9IHJlcS51cmwgfHwgJyc7XHJcblxyXG4gICAgICAgICAgLy8gUmV3cml0ZSByb3V0ZXMgdG8gdGhlIGFkbWluIHNoZWxsXHJcbiAgICAgICAgICBpZiAodXJsLnN0YXJ0c1dpdGgoJy9hZG1pbicpICYmICF1cmwuaW5jbHVkZXMoJy4nKSkge1xyXG4gICAgICAgICAgICByZXEudXJsID0gJy9hZG1pbi5odG1sJztcclxuICAgICAgICAgICAgcmV0dXJuIG5leHQoKTtcclxuICAgICAgICAgIH1cclxuXHJcbiAgICAgICAgICAvLyBcdUQ4M0RcdURFRTFcdUZFMEYgR09MREVOIFJVTEU6IFN0cmljdCBEaXJlY3RvcnktQmFzZWQgSXNvbGF0aW9uXHJcbiAgICAgICAgICAvLyBFdmVyeXRoaW5nIGluIC9zcmMvYWRtaW4vIGlzIGNvbnNpZGVyZWQgcHJpdmF0ZSBhbmQgcmVxdWlyZXMgY3J5cHRvZ3JhcGhpYyBwcm9vZi5cclxuICAgICAgICAgIGNvbnN0IGlzSW50ZXJuYWxBZG1pbiA9IHVybC5pbmNsdWRlcygnL3NyYy9hZG1pbi8nKTtcclxuXHJcbiAgICAgICAgICBpZiAoaXNJbnRlcm5hbEFkbWluKSB7XHJcbiAgICAgICAgICAgIC8vIFx1MjcwNSBBU1NFVCBXSElURUxJU1QgKEhhcmQgUnVsZSkgZm9yIEhNUiAmIERldiBTb3VyY2UgTG9hZGluZ1xyXG4gICAgICAgICAgICAvLyBWaXRlIHJlcXVlc3RzIHNvdXJjZSBmaWxlcyAoLnRzeCwgLmNzcykgdmlhIEhUVFAgZHVyaW5nIGRldi4gXHJcbiAgICAgICAgICAgIC8vIFZhbGlkYXRpbmcgSldUcyBvbiBjb2RlIGNvbXBvbmVudHMgYnJlYWtzIEhNUiBhbmQgSGFyZCBSZWxvYWRzLlxyXG4gICAgICAgICAgICBjb25zdCBpc0Fzc2V0ID1cclxuICAgICAgICAgICAgICB1cmwuaW5jbHVkZXMoJy50c3gnKSB8fFxyXG4gICAgICAgICAgICAgIHVybC5pbmNsdWRlcygnLnRzJykgfHxcclxuICAgICAgICAgICAgICB1cmwuaW5jbHVkZXMoJy5qc3gnKSB8fFxyXG4gICAgICAgICAgICAgIHVybC5pbmNsdWRlcygnLmpzJykgfHxcclxuICAgICAgICAgICAgICB1cmwuaW5jbHVkZXMoJy5jc3MnKSB8fFxyXG4gICAgICAgICAgICAgIHVybC5pbmNsdWRlcygnLmpzb24nKSB8fFxyXG4gICAgICAgICAgICAgIHVybC5pbmNsdWRlcygnLm1hcCcpIHx8XHJcbiAgICAgICAgICAgICAgdXJsLmluY2x1ZGVzKCdub2RlX21vZHVsZXMnKSB8fFxyXG4gICAgICAgICAgICAgIHVybC5pbmNsdWRlcygnL0B2aXRlLycpIHx8XHJcbiAgICAgICAgICAgICAgdXJsLmluY2x1ZGVzKCc/dD0nKTsgLy8gSE1SIFRpbWVzdGFtcFxyXG5cclxuICAgICAgICAgICAgaWYgKGlzQXNzZXQpIHtcclxuICAgICAgICAgICAgICAvLyBBbGxvdyBWaXRlIHRvIHNlcnZlIHRoZSBzb3VyY2UgY29kZS5cclxuICAgICAgICAgICAgICAvLyBTZWN1cml0eSBpcyBlbmZvcmNlZCBhdCBEYXRhIExheWVyIChBUEkpIGFuZCBSdW50aW1lIChBZG1pbkd1YXJkKS5cclxuXHJcbiAgICAgICAgICAgICAgLy8gXHVEODNFXHVEREY5IENMRUFOVVA6IFN0cmlwIEpXVCBmcm9tIFVSTCBpZiBwcmVzZW50IGluICd0JyBwYXJhbVxyXG4gICAgICAgICAgICAgIC8vIFRoaXMgcHJldmVudHMgJ3ZpdGU6ZXNidWlsZCcgZnJvbSBjcmFzaGluZyBkdWUgdG8gXCJJbnZhbGlkIGxvYWRlciB2YWx1ZVwiXHJcbiAgICAgICAgICAgICAgLy8gd2hlbiBpdCBlbmNvdW50ZXJzIGEgbWFzc2l2ZSBKV1QgaW4gdGhlIHF1ZXJ5IHN0cmluZy5cclxuICAgICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcclxuICAgICAgICAgICAgICBjb25zdCB0UGFyYW0gPSBwYXJzZWRVcmwuc2VhcmNoUGFyYW1zLmdldCgndCcpO1xyXG5cclxuICAgICAgICAgICAgICAvLyBJZiAndCcgbG9va3MgbGlrZSBhIEpXVCAoc3RhcnRzIHdpdGggJ2V5JyBvciBpcyB2ZXJ5IGxvbmcpLCByZW1vdmUgaXQuXHJcbiAgICAgICAgICAgICAgLy8gU3RhbmRhcmQgVml0ZSBITVIgJ3QnIGlzIHVzdWFsbHkgYSB0aW1lc3RhbXAgKG51bWVyaWMpLlxyXG4gICAgICAgICAgICAgIC8vIFdlIHByZXNlcnZlIHNob3J0IG51bWVyaWMgJ3QnIGZvciBjYWNoZSBidXN0aW5nIGlmIG5lZWRlZC5cclxuICAgICAgICAgICAgICBpZiAodFBhcmFtICYmICh0UGFyYW0ubGVuZ3RoID4gNTAgfHwgdFBhcmFtLnN0YXJ0c1dpdGgoJ2V5JykpKSB7XHJcbiAgICAgICAgICAgICAgICBwYXJzZWRVcmwuc2VhcmNoUGFyYW1zLmRlbGV0ZSgndCcpO1xyXG4gICAgICAgICAgICAgICAgcmVxLnVybCA9IHBhcnNlZFVybC5wYXRobmFtZSArIHBhcnNlZFVybC5zZWFyY2g7XHJcbiAgICAgICAgICAgICAgfVxyXG5cclxuICAgICAgICAgICAgICByZXR1cm4gbmV4dCgpO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICBjb25zdCBwYXJzZWRVcmwgPSBuZXcgVVJMKHVybCwgJ2h0dHA6Ly9sb2NhbGhvc3QnKTtcclxuICAgICAgICAgICAgY29uc3QgcXVlcnlUb2tlbiA9IHBhcnNlZFVybC5zZWFyY2hQYXJhbXMuZ2V0KCd0Jyk7XHJcbiAgICAgICAgICAgIGNvbnN0IGNvb2tpZVRva2VuID0gcmVxLmhlYWRlcnMuY29va2llPy5zcGxpdCgnOyAnKS5maW5kKHJvdyA9PiByb3cuc3RhcnRzV2l0aCgnYWRtaW5fand0PScpKT8uc3BsaXQoJz0nKVsxXTtcclxuXHJcbiAgICAgICAgICAgIGNvbnN0IHRva2VuID0gcXVlcnlUb2tlbiB8fCBjb29raWVUb2tlbjtcclxuXHJcbiAgICAgICAgICAgIGlmICghdG9rZW4pIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFtTRUNVUklUWV0gR29sZGVuIFJ1bGUgSW50ZXJjZXB0aW9uOiBCbG9ja2VkIGludGVybmFsIGFzc2V0ICR7dXJsfSAoTWlzc2luZyBUb2tlbilgKTtcclxuICAgICAgICAgICAgICByZXMuc3RhdHVzQ29kZSA9IDQwMTtcclxuICAgICAgICAgICAgICByZXMuZW5kKCdVbmF1dGhvcml6ZWQ6IEFkbWluIEludGVybmFsIEFzc2V0cyByZXF1aXJlIGEgdmFsaWQgU2VjdXJpdHkgVG9rZW4uJyk7XHJcbiAgICAgICAgICAgICAgcmV0dXJuO1xyXG4gICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICAgIC8vIFx1RDgzRFx1REVFMVx1RkUwRiBSRUdMQSBERSBPUk8gKERFVik6IFZhbGlkYWNpXHUwMEYzbiBDcmlwdG9nclx1MDBFMWZpY2EgZGUgbGEgRmlybWEgWSBST0xcclxuICAgICAgICAgICAgICBjb25zdCBkZWNvZGVkID0gand0LnZlcmlmeSh0b2tlbiwgSldUX1NFQ1JFVCkgYXMgYW55O1xyXG5cclxuICAgICAgICAgICAgICBpZiAoZGVjb2RlZC5yb2xlICE9PSAnYWRtaW4nICYmIGRlY29kZWQucm9sZSAhPT0gJ3N1cGVyX2FkbWluJykge1xyXG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBbU0VDVVJJVFldIEdvbGRlbiBSdWxlIEludGVyY2VwdGlvbjogQmxvY2tlZCBpbnRlcm5hbCBhc3NldCAke3VybH0gKEluc3VmZmljaWVudCBQZXJtaXNzaW9uczogJHtkZWNvZGVkLnJvbGV9KWApO1xyXG4gICAgICAgICAgICAgICAgcmVzLnN0YXR1c0NvZGUgPSA0MDM7XHJcbiAgICAgICAgICAgICAgICByZXMuZW5kKCdGb3JiaWRkZW46IEFkbWluIEF1dGhvcml0eSBSZXF1aXJlZC4nKTtcclxuICAgICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgICB9XHJcblxyXG4gICAgICAgICAgICAgIC8vIFx1MjcwNSBWYWxpZCBUb2tlbiAmIFJvbGUgLT4gUHJvY2VlZCBhbmQgc2V0L3JlZnJlc2ggY29va2llIGlmIGl0IGNhbWUgZnJvbSBxdWVyeVxyXG4gICAgICAgICAgICAgIGlmIChxdWVyeVRva2VuKSB7XHJcbiAgICAgICAgICAgICAgICByZXMuc2V0SGVhZGVyKCdTZXQtQ29va2llJywgYGFkbWluX2p3dD0ke3F1ZXJ5VG9rZW59OyBQYXRoPS87IEh0dHBPbmx5OyBTYW1lU2l0ZT1MYXg7IE1heC1BZ2U9MzYwMGApO1xyXG4gICAgICAgICAgICAgICAgLy8gU3RyaXAgdG9rZW4gZm9yIGludGVybmFsIGVzYnVpbGQgcHJvY2Vzc2luZ1xyXG4gICAgICAgICAgICAgICAgcGFyc2VkVXJsLnNlYXJjaFBhcmFtcy5kZWxldGUoJ3QnKTtcclxuICAgICAgICAgICAgICAgIHJlcS51cmwgPSBwYXJzZWRVcmwucGF0aG5hbWUgKyBwYXJzZWRVcmwuc2VhcmNoO1xyXG4gICAgICAgICAgICAgIH1cclxuICAgICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcclxuICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFtTRUNVUklUWV0gR29sZGVuIFJ1bGUgSW50ZXJjZXB0aW9uOiBCbG9ja2VkIGludGVybmFsIGFzc2V0ICR7dXJsfSAoSW52YWxpZC9Gb3JnZWQgVG9rZW46ICR7ZXJyLm1lc3NhZ2V9KWApO1xyXG4gICAgICAgICAgICAgIHJlcy5zdGF0dXNDb2RlID0gNDAxO1xyXG4gICAgICAgICAgICAgIHJlcy5lbmQoJ1VuYXV0aG9yaXplZDogSW52YWxpZCBvciBFeHBpcmVkIFNlY3VyaXR5IFRva2VuLicpO1xyXG4gICAgICAgICAgICAgIHJldHVybjtcclxuICAgICAgICAgICAgfVxyXG4gICAgICAgICAgfVxyXG5cclxuXHJcblxyXG5cclxuICAgICAgICAgIG5leHQoKTtcclxuICAgICAgICB9KTtcclxuICAgICAgfSxcclxuICAgICAgLy8gMi4gXHUyNkExIFBST0QgUkVTT0xWRVI6IEluamVjdCBoYXNoZWQgcGF0aHMgaW50byB0aGUgZHluYW1pYyBsb2FkZXJcclxuICAgICAgdHJhbnNmb3JtSW5kZXhIdG1sOiB7XHJcbiAgICAgICAgb3JkZXI6ICdwb3N0JyxcclxuICAgICAgICBoYW5kbGVyKGh0bWwsIGN0eCkge1xyXG4gICAgICAgICAgaWYgKCFjdHguZmlsZW5hbWUuZW5kc1dpdGgoJ2FkbWluLmh0bWwnKSkgcmV0dXJuIGh0bWw7XHJcblxyXG4gICAgICAgICAgLy8gSW4gZGV2LCBjdHguYnVuZGxlIGlzIHVuZGVmaW5lZC4gUGF0aHMgcmVtYWluIC9zcmMvLi4uXHJcbiAgICAgICAgICBpZiAoIWN0eC5idW5kbGUpIHJldHVybiBodG1sO1xyXG5cclxuICAgICAgICAgIC8vIEluIHByb2R1Y3Rpb24sIHdlIGZpbmQgdGhlIGhhc2hlZCBlbnRyeSBwb2ludHMgZnJvbSB0aGUgYnVuZGxlXHJcbiAgICAgICAgICBjb25zdCBhZG1pbkVudHJ5ID0gT2JqZWN0LnZhbHVlcyhjdHguYnVuZGxlKS5maW5kKGYgPT4gZi5uYW1lID09PSAnYWRtaW4nICYmIGYudHlwZSA9PT0gJ2NodW5rJyk7XHJcbiAgICAgICAgICBjb25zdCBsb2dpbkVudHJ5ID0gT2JqZWN0LnZhbHVlcyhjdHguYnVuZGxlKS5maW5kKGYgPT4gZi5uYW1lID09PSAnYWRtaW5fbG9naW4nICYmIGYudHlwZSA9PT0gJ2NodW5rJyk7XHJcblxyXG4gICAgICAgICAgcmV0dXJuIGh0bWxcclxuICAgICAgICAgICAgLnJlcGxhY2UoJy9zcmMvYWRtaW4vZW50cnkudHN4JywgYC9hZG1pbi1hc3NldHMvaW50ZXJuYWwvJHthZG1pbkVudHJ5Py5maWxlTmFtZSB8fCAnJ31gKVxyXG4gICAgICAgICAgICAucmVwbGFjZSgnL3NyYy9hZG1pbi1sb2dpbi50c3gnLCBgL2FkbWluLWFzc2V0cy9wdWJsaWMvJHtsb2dpbkVudHJ5Py5maWxlTmFtZSB8fCAnJ31gKTtcclxuXHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9XHJcblxyXG4gIF0sXHJcbiAgcmVzb2x2ZToge1xyXG4gICAgYWxpYXM6IHtcclxuICAgICAgJ0AnOiBmaWxlVVJMVG9QYXRoKG5ldyBVUkwoJy4vc3JjJywgaW1wb3J0Lm1ldGEudXJsKSksXHJcbiAgICB9LFxyXG4gICAgZGVkdXBlOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJywgJ3JlYWN0LWhlbG1ldC1hc3luYyddLFxyXG4gIH0sXHJcbiAgb3B0aW1pemVEZXBzOiB7XHJcbiAgICBpbmNsdWRlOiBbXHJcbiAgICAgICdyZWFjdCcsXHJcbiAgICAgICdyZWFjdC1kb20nLFxyXG4gICAgICAncmVhY3Qtcm91dGVyLWRvbScsXHJcbiAgICAgICdyZWFjdC1yb3V0ZXItZG9tJyxcclxuICAgICAgJ2ZyYW1lci1tb3Rpb24nLFxyXG4gICAgICAnbHVjaWRlLXJlYWN0JyxcclxuICAgICAgJ0B0YW5zdGFjay9yZWFjdC1xdWVyeSdcclxuICAgIF0sXHJcbiAgICBleGNsdWRlOiBbXSxcclxuICB9LFxyXG4gIHNlcnZlcjoge1xyXG4gICAgcG9ydDogNTE3NCxcclxuICAgIGhtcjoge1xyXG4gICAgICBwcm90b2NvbDogJ3dzJyxcclxuICAgICAgaG9zdDogJ2xvY2FsaG9zdCcsXHJcbiAgICB9LFxyXG4gICAgcHJveHk6IHtcclxuICAgICAgJy9hcGknOiB7XHJcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovL2xvY2FsaG9zdDozMDAwJyxcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcclxuICAgICAgfVxyXG4gICAgfSxcclxuICB9LFxyXG4gIGJhc2U6ICcvJyxcclxuICBidWlsZDoge1xyXG4gICAgZW1wdHlPdXREaXI6IHRydWUsXHJcbiAgICB0YXJnZXQ6ICdlczIwMjAnLFxyXG4gICAgYXNzZXRzRGlyOiAnYXNzZXRzJyxcclxuICAgIHNvdXJjZW1hcDogZmFsc2UsXHJcbiAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDUwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgaW5wdXQ6IHtcclxuICAgICAgICBtYWluOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnaW5kZXguaHRtbCcpLFxyXG4gICAgICAgIGFkbWluOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnYWRtaW4uaHRtbCcpLFxyXG4gICAgICAgIGFkbWluX2xvZ2luOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2FkbWluLWxvZ2luLnRzeCcpLFxyXG4gICAgICAgIGFkbWluX2ludGVybmFsOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCAnc3JjL2FkbWluL2VudHJ5LnRzeCcpLFxyXG5cclxuXHJcbiAgICAgIH0sXHJcblxyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBjaHVua0ZpbGVOYW1lczogKGNodW5rSW5mbykgPT4ge1xyXG4gICAgICAgICAgY29uc3QgbmFtZSA9IGNodW5rSW5mby5uYW1lLnRvTG93ZXJDYXNlKCk7XHJcblxyXG5cclxuICAgICAgICAgIC8vIFx1RDgzRFx1REQzNCBTRU5TSVRJVkUgQ0hVTktTIChHYXRlZCBieSBHb2xkZW4gUnVsZSlcclxuICAgICAgICAgIC8vIEFueSBjaHVuayBjb21pbmcgZnJvbSB0aGUgc3JjL2FkbWluIGRpcmVjdG9yeSBpcyBzdHJpY3RseSBpbnRlcm5hbC5cclxuICAgICAgICAgIGNvbnN0IGlzSW50ZXJuYWxBZG1pbiA9IGNodW5rSW5mby5mYWNhZGVNb2R1bGVJZD8uaW5jbHVkZXMoJy9zcmMvYWRtaW4vJyk7XHJcblxyXG4gICAgICAgICAgaWYgKGlzSW50ZXJuYWxBZG1pbiB8fCBuYW1lLmluY2x1ZGVzKCdhZG1pbl9pbnRlcm5hbCcpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiAnYWRtaW4tYXNzZXRzL2ludGVybmFsL1tuYW1lXS1baGFzaF0uanMnO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIC8vIFx1RDgzRFx1REZFMiBQVUJMSUMgQURNSU4gQ0hVTktTIChSZXF1aXJlZCBmb3IgTG9naW4gU2hlbGwpXHJcbiAgICAgICAgICBpZiAobmFtZS5pbmNsdWRlcygnYWRtaW5fbG9naW4nKSB8fCBuYW1lLmluY2x1ZGVzKCdhZG1pbmxvZ2luJykpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdhZG1pbi1hc3NldHMvcHVibGljL1tuYW1lXS1baGFzaF0uanMnO1xyXG4gICAgICAgICAgfVxyXG5cclxuXHJcblxyXG4gICAgICAgICAgaWYgKG5hbWUuaW5jbHVkZXMoJ2FkbWluJykpIHtcclxuICAgICAgICAgICAgLy8gRGVmYXVsdCB0byBpbnRlcm5hbCBpZiBhbWJpZ3VvdXMgdG8gYXZvaWQgYWNjaWRlbnRhbCBsZWFrYWdlXHJcbiAgICAgICAgICAgIHJldHVybiAnYWRtaW4tYXNzZXRzL2ludGVybmFsL1tuYW1lXS1baGFzaF0uanMnO1xyXG4gICAgICAgICAgfVxyXG5cclxuICAgICAgICAgIHJldHVybiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnO1xyXG4gICAgICAgIH0sXHJcblxyXG4gICAgICAgIGVudHJ5RmlsZU5hbWVzOiAoY2h1bmtJbmZvKSA9PiB7XHJcbiAgICAgICAgICBpZiAoY2h1bmtJbmZvLm5hbWUgPT09ICdhZG1pbicpIHtcclxuICAgICAgICAgICAgcmV0dXJuICdhZG1pbi1hc3NldHMvaW50ZXJuYWwvYWRtaW4tZW50cnktW2hhc2hdLmpzJztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIGlmIChjaHVua0luZm8ubmFtZSA9PT0gJ2FkbWluX2xvZ2luJykge1xyXG4gICAgICAgICAgICByZXR1cm4gJ2FkbWluLWFzc2V0cy9wdWJsaWMvbG9naW4tZW50cnktW2hhc2hdLmpzJztcclxuICAgICAgICAgIH1cclxuICAgICAgICAgIHJldHVybiAnYXNzZXRzL1tuYW1lXS1baGFzaF0uanMnO1xyXG4gICAgICAgIH0sXHJcbiAgICAgICAgYXNzZXRGaWxlTmFtZXM6IChhc3NldEluZm8pID0+IHtcclxuICAgICAgICAgIGNvbnN0IG5hbWUgPSBhc3NldEluZm8ubmFtZT8udG9Mb3dlckNhc2UoKSB8fCAnJztcclxuICAgICAgICAgIGlmIChuYW1lLmluY2x1ZGVzKCdhZG1pbicpKSB7XHJcbiAgICAgICAgICAgIGlmIChuYW1lLmluY2x1ZGVzKCdsb2dpbicpKSByZXR1cm4gJ2FkbWluLWFzc2V0cy9wdWJsaWMvW25hbWVdLVtoYXNoXVtleHRuYW1lXSc7XHJcbiAgICAgICAgICAgIHJldHVybiAnYWRtaW4tYXNzZXRzL2ludGVybmFsL1tuYW1lXS1baGFzaF1bZXh0bmFtZV0nO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgICAgcmV0dXJuICdhc3NldHMvW25hbWVdLVtoYXNoXVtleHRuYW1lXSc7XHJcbiAgICAgICAgfSxcclxuXHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAvLyBDb3JlIFJlYWN0IC0gY2hhbmdlcyByYXJlbHksIGhpZ2ggY2FjaGUgdmFsdWVcclxuICAgICAgICAgICd2ZW5kb3ItcmVhY3QnOiBbJ3JlYWN0JywgJ3JlYWN0LWRvbScsICdyZWFjdC1yb3V0ZXItZG9tJywgJ3JlYWN0LWhlbG1ldC1hc3luYyddLFxyXG5cclxuICAgICAgICAgIC8vIERhdGEgbGF5ZXIgLSBjaGFuZ2VzIHJhcmVseVxyXG4gICAgICAgICAgJ3ZlbmRvci1xdWVyeSc6IFsnQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5J10sXHJcblxyXG4gICAgICAgICAgLy8gVUkgYW5pbWF0aW9ucyAtIG1lZGl1bSBjaGFuZ2UgZnJlcXVlbmN5XHJcbiAgICAgICAgICAndmVuZG9yLXVpJzogWydmcmFtZXItbW90aW9uJywgJ2x1Y2lkZS1yZWFjdCddLFxyXG5cclxuICAgICAgICAgIC8vIE1hcCAtIGxhenkgbG9hZGVkIHZpYSByb3V0ZSwgbGFyZ2UgYnVuZGxlXHJcbiAgICAgICAgICAndmVuZG9yLW1hcCc6IFsnbGVhZmxldCcsICdyZWFjdC1sZWFmbGV0JywgJ3JlYWN0LWxlYWZsZXQtY2x1c3RlciddLFxyXG5cclxuICAgICAgICAgIC8vIFJpY2ggdGV4dCBlZGl0b3IgLSBsYXp5IGxvYWRlZCwgbGFyZ2UgYnVuZGxlXHJcbiAgICAgICAgICAndmVuZG9yLWVkaXRvcic6IFtcclxuICAgICAgICAgICAgJ0B0aXB0YXAvcmVhY3QnLFxyXG4gICAgICAgICAgICAnQHRpcHRhcC9zdGFydGVyLWtpdCcsXHJcbiAgICAgICAgICAgICdAdGlwdGFwL2V4dGVuc2lvbi1tZW50aW9uJyxcclxuICAgICAgICAgICAgJ0B0aXB0YXAvZXh0ZW5zaW9uLXBsYWNlaG9sZGVyJyxcclxuICAgICAgICAgICAgJ0B0aXB0YXAvZXh0ZW5zaW9uLWNoYXJhY3Rlci1jb3VudCcsXHJcbiAgICAgICAgICAgICdAdGlwdGFwL2V4dGVuc2lvbi11bmRlcmxpbmUnLFxyXG4gICAgICAgICAgXSxcclxuXHJcbiAgICAgICAgICAvLyBGb3JtIGhhbmRsaW5nXHJcbiAgICAgICAgICAndmVuZG9yLWZvcm1zJzogWydyZWFjdC1ob29rLWZvcm0nLCAnQGhvb2tmb3JtL3Jlc29sdmVycycsICd6b2QnXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KVxyXG5cclxuIiwgIntcclxuICBcIm5hbWVcIjogXCJzYWZlc3BvdFwiLFxyXG4gIFwicHJpdmF0ZVwiOiB0cnVlLFxyXG4gIFwidmVyc2lvblwiOiBcIjIuNC4wLXByb1wiLFxyXG4gIFwidHlwZVwiOiBcIm1vZHVsZVwiLFxyXG4gIFwic2NyaXB0c1wiOiB7XHJcbiAgICBcImRldlwiOiBcInZpdGVcIixcclxuICAgIFwiYnVpbGRcIjogXCJ0c2MgJiYgdml0ZSBidWlsZFwiLFxyXG4gICAgXCJsaW50XCI6IFwiZXNsaW50IC4gLS1leHQgdHMsdHN4IC0tcmVwb3J0LXVudXNlZC1kaXNhYmxlLWRpcmVjdGl2ZXMgLS1tYXgtd2FybmluZ3MgMFwiLFxyXG4gICAgXCJwcmV2aWV3XCI6IFwidml0ZSBwcmV2aWV3XCIsXHJcbiAgICBcInRlc3RcIjogXCJ2aXRlc3RcIixcclxuICAgIFwidGVzdDp1bml0XCI6IFwidml0ZXN0IHJ1biB0ZXN0cy91bml0XCIsXHJcbiAgICBcInRlc3Q6aW50ZWdyYXRpb25cIjogXCJ2aXRlc3QgcnVuIHRlc3RzL2ludGVncmF0aW9uXCIsXHJcbiAgICBcInRlc3Q6Y29udHJhY3RcIjogXCJ2aXRlc3QgcnVuIHRlc3RzL2NvbnRyYWN0XCIsXHJcbiAgICBcInRlc3Q6ZTJlXCI6IFwicGxheXdyaWdodCB0ZXN0XCIsXHJcbiAgICBcInRlc3Q6YWxsXCI6IFwibnBtIHJ1biB0ZXN0OnVuaXQgJiYgbnBtIHJ1biB0ZXN0OmludGVncmF0aW9uICYmIG5wbSBydW4gdGVzdDpjb250cmFjdCAmJiBucG0gcnVuIHRlc3Q6ZTJlXCIsXHJcbiAgICBcInRlc3Q6cnVuXCI6IFwidml0ZXN0IHJ1blwiLFxyXG4gICAgXCJ0ZXN0OmNvdmVyYWdlXCI6IFwidml0ZXN0IHJ1biAtLWNvdmVyYWdlXCJcclxuICB9LFxyXG4gIFwiZGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQGhvb2tmb3JtL3Jlc29sdmVyc1wiOiBcIl41LjIuMlwiLFxyXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtZHJvcGRvd24tbWVudVwiOiBcIl4yLjEuMTZcIixcclxuICAgIFwiQHJhZGl4LXVpL3JlYWN0LXN3aXRjaFwiOiBcIl4xLjIuNlwiLFxyXG4gICAgXCJAcmFkaXgtdWkvcmVhY3QtdG9vbHRpcFwiOiBcIl4xLjIuOFwiLFxyXG4gICAgXCJAcmVhY3Qtb2F1dGgvZ29vZ2xlXCI6IFwiXjAuMTMuNFwiLFxyXG4gICAgXCJAc2VudHJ5L3JlYWN0XCI6IFwiXjEwLjM0LjBcIixcclxuICAgIFwiQHRhbnN0YWNrL3JlYWN0LXF1ZXJ5XCI6IFwiXjUuOTAuMTRcIixcclxuICAgIFwiQHRhbnN0YWNrL3JlYWN0LXZpcnR1YWxcIjogXCJeMy4xMy4xNFwiLFxyXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi1jaGFyYWN0ZXItY291bnRcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLW1lbnRpb25cIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvZXh0ZW5zaW9uLXBsYWNlaG9sZGVyXCI6IFwiXjMuMTQuMFwiLFxyXG4gICAgXCJAdGlwdGFwL2V4dGVuc2lvbi11bmRlcmxpbmVcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvcmVhY3RcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvc3RhcnRlci1raXRcIjogXCJeMy4xNC4wXCIsXHJcbiAgICBcIkB0aXB0YXAvc3VnZ2VzdGlvblwiOiBcIl4zLjE0LjBcIixcclxuICAgIFwiYnJvd3Nlci1pbWFnZS1jb21wcmVzc2lvblwiOiBcIl4yLjAuMlwiLFxyXG4gICAgXCJjYW52YXMtY29uZmV0dGlcIjogXCJeMS45LjRcIixcclxuICAgIFwiY2xzeFwiOiBcIl4yLjAuMFwiLFxyXG4gICAgXCJkYXRlLWZuc1wiOiBcIl40LjEuMFwiLFxyXG4gICAgXCJmcmFtZXItbW90aW9uXCI6IFwiXjEyLjIzLjI2XCIsXHJcbiAgICBcImxlYWZsZXRcIjogXCJeMS45LjRcIixcclxuICAgIFwibGVhZmxldC1nZXN0dXJlLWhhbmRsaW5nXCI6IFwiXjEuMi4yXCIsXHJcbiAgICBcImx1Y2lkZS1yZWFjdFwiOiBcIl4wLjI5NC4wXCIsXHJcbiAgICBcInJlYWN0XCI6IFwiMTguMi4wXCIsXHJcbiAgICBcInJlYWN0LWRvbVwiOiBcIjE4LjIuMFwiLFxyXG4gICAgXCJyZWFjdC1oZWxtZXQtYXN5bmNcIjogXCJeMi4wLjVcIixcclxuICAgIFwicmVhY3QtaG9vay1mb3JtXCI6IFwiXjcuNjkuMFwiLFxyXG4gICAgXCJyZWFjdC1qb3lyaWRlXCI6IFwiXjIuOS4zXCIsXHJcbiAgICBcInJlYWN0LWxlYWZsZXRcIjogXCJeNC4yLjFcIixcclxuICAgIFwicmVhY3QtbGVhZmxldC1jbHVzdGVyXCI6IFwiXjIuMS4wXCIsXHJcbiAgICBcInJlYWN0LW1hcmtkb3duXCI6IFwiXjkuMC4xXCIsXHJcbiAgICBcInJlYWN0LXJvdXRlci1kb21cIjogXCJeNi4yMC4wXCIsXHJcbiAgICBcInJlbWFyay1nZm1cIjogXCJeNC4wLjFcIixcclxuICAgIFwidGFpbHdpbmQtbWVyZ2VcIjogXCJeMi4wLjBcIixcclxuICAgIFwidGlwcHkuanNcIjogXCJeNi4zLjdcIixcclxuICAgIFwidXVpZFwiOiBcIl4xMy4wLjBcIixcclxuICAgIFwiem9kXCI6IFwiXjMuMjIuNFwiLFxyXG4gICAgXCJ6dXN0YW5kXCI6IFwiXjQuNC43XCJcclxuICB9LFxyXG4gIFwiZGV2RGVwZW5kZW5jaWVzXCI6IHtcclxuICAgIFwiQHBsYXl3cmlnaHQvdGVzdFwiOiBcIl4xLjU3LjBcIixcclxuICAgIFwiQHRlc3RpbmctbGlicmFyeS9qZXN0LWRvbVwiOiBcIl42LjkuMVwiLFxyXG4gICAgXCJAdGVzdGluZy1saWJyYXJ5L3JlYWN0XCI6IFwiXjE2LjMuMVwiLFxyXG4gICAgXCJAdHlwZXMvYmNyeXB0XCI6IFwiXjYuMC4wXCIsXHJcbiAgICBcIkB0eXBlcy9iY3J5cHRqc1wiOiBcIl4yLjQuNlwiLFxyXG4gICAgXCJiY3J5cHRqc1wiOiBcIl4yLjQuM1wiLFxyXG4gICAgXCJAdHlwZXMvY2FudmFzLWNvbmZldHRpXCI6IFwiXjEuOS4wXCIsXHJcbiAgICBcIkB0eXBlcy9qc29ud2VidG9rZW5cIjogXCJeOS4wLjEwXCIsXHJcbiAgICBcIkB0eXBlcy9sZWFmbGV0XCI6IFwiXjEuOS4yMVwiLFxyXG4gICAgXCJAdHlwZXMvbm9kZVwiOiBcIl4yNS4wLjNcIixcclxuICAgIFwiQHR5cGVzL3JlYWN0XCI6IFwiXjE4LjIuMzdcIixcclxuICAgIFwiQHR5cGVzL3JlYWN0LWRvbVwiOiBcIl4xOC4yLjE1XCIsXHJcbiAgICBcIkB0eXBlcy9zdXBlcnRlc3RcIjogXCJeNi4wLjNcIixcclxuICAgIFwiQHR5cGVzL3V1aWRcIjogXCJeMTAuMC4wXCIsXHJcbiAgICBcIkB0eXBlc2NyaXB0LWVzbGludC9lc2xpbnQtcGx1Z2luXCI6IFwiXjYuMTAuMFwiLFxyXG4gICAgXCJAdHlwZXNjcmlwdC1lc2xpbnQvcGFyc2VyXCI6IFwiXjYuMTAuMFwiLFxyXG4gICAgXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiOiBcIl40LjIuMFwiLFxyXG4gICAgXCJAdml0ZXN0L2NvdmVyYWdlLXY4XCI6IFwiXjQuMC4xN1wiLFxyXG4gICAgXCJhdXRvcHJlZml4ZXJcIjogXCJeMTAuNC4xNlwiLFxyXG4gICAgXCJkb3RlbnZcIjogXCJeMTcuMi4zXCIsXHJcbiAgICBcImVzbGludFwiOiBcIl44LjUzLjBcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi1sb2NhbC1ydWxlc1wiOiBcImZpbGU6ZXNsaW50LXJ1bGVzXCIsXHJcbiAgICBcImVzbGludC1wbHVnaW4tcmVhY3QtaG9va3NcIjogXCJeNC42LjBcIixcclxuICAgIFwiZXNsaW50LXBsdWdpbi1yZWFjdC1yZWZyZXNoXCI6IFwiXjAuNC40XCIsXHJcbiAgICBcImpzZG9tXCI6IFwiXjI3LjQuMFwiLFxyXG4gICAgXCJqc29ud2VidG9rZW5cIjogXCJeOS4wLjNcIixcclxuICAgIFwicG9zdGNzc1wiOiBcIl44LjQuMzFcIixcclxuICAgIFwic3VwZXJ0ZXN0XCI6IFwiXjcuMi4yXCIsXHJcbiAgICBcInRhaWx3aW5kY3NzXCI6IFwiXjMuMy41XCIsXHJcbiAgICBcInR5cGVzY3JpcHRcIjogXCJeNS4yLjJcIixcclxuICAgIFwidml0ZVwiOiBcIl41LjAuMFwiLFxyXG4gICAgXCJ2aXRlLXBsdWdpbi1wd2FcIjogXCJeMS4yLjBcIixcclxuICAgIFwidml0ZXN0XCI6IFwiXjQuMC4xN1wiLFxyXG4gICAgXCJ3b3JrYm94LXdpbmRvd1wiOiBcIl43LjQuMFwiXHJcbiAgfSxcclxuICBcImVuZ2luZXNcIjoge1xyXG4gICAgXCJub2RlXCI6IFwiPj0xOFwiXHJcbiAgfSxcclxuICBcImluY2x1ZGVcIjogW1xyXG4gICAgXCJzcmNcIixcclxuICAgIFwidGVzdHNcIlxyXG4gIF1cclxufSJdLAogICJtYXBwaW5ncyI6ICI7QUFBNFQsU0FBUyxvQkFBb0I7QUFDelYsT0FBTyxXQUFXO0FBQ2xCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGVBQWUsV0FBVztBQUNuQyxPQUFPLFFBQVE7QUFDZixPQUFPLFVBQVU7OztBQ0xqQjtBQUFBLEVBQ0UsTUFBUTtBQUFBLEVBQ1IsU0FBVztBQUFBLEVBQ1gsU0FBVztBQUFBLEVBQ1gsTUFBUTtBQUFBLEVBQ1IsU0FBVztBQUFBLElBQ1QsS0FBTztBQUFBLElBQ1AsT0FBUztBQUFBLElBQ1QsTUFBUTtBQUFBLElBQ1IsU0FBVztBQUFBLElBQ1gsTUFBUTtBQUFBLElBQ1IsYUFBYTtBQUFBLElBQ2Isb0JBQW9CO0FBQUEsSUFDcEIsaUJBQWlCO0FBQUEsSUFDakIsWUFBWTtBQUFBLElBQ1osWUFBWTtBQUFBLElBQ1osWUFBWTtBQUFBLElBQ1osaUJBQWlCO0FBQUEsRUFDbkI7QUFBQSxFQUNBLGNBQWdCO0FBQUEsSUFDZCx1QkFBdUI7QUFBQSxJQUN2QixpQ0FBaUM7QUFBQSxJQUNqQywwQkFBMEI7QUFBQSxJQUMxQiwyQkFBMkI7QUFBQSxJQUMzQix1QkFBdUI7QUFBQSxJQUN2QixpQkFBaUI7QUFBQSxJQUNqQix5QkFBeUI7QUFBQSxJQUN6QiwyQkFBMkI7QUFBQSxJQUMzQixxQ0FBcUM7QUFBQSxJQUNyQyw2QkFBNkI7QUFBQSxJQUM3QixpQ0FBaUM7QUFBQSxJQUNqQywrQkFBK0I7QUFBQSxJQUMvQixpQkFBaUI7QUFBQSxJQUNqQix1QkFBdUI7QUFBQSxJQUN2QixzQkFBc0I7QUFBQSxJQUN0Qiw2QkFBNkI7QUFBQSxJQUM3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
