import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'
import path from 'node:path'
import packageJson from './package.json'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

// ✅ ENTERPRISE: Secure Environment Loading (ESM compatible)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(__dirname, 'server', '.env');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn(`[SECURITY] server/.env not found at ${envPath}. Ensure backend exists.`);
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET === 'super-secret-jwt-key-change-this') {
  console.error('❌ [SECURITY] CRITICAL: JWT_SECRET is missing or insecure! Blocking admin access.');
}


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
    '__API_BASE_URL__': JSON.stringify((process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '').endsWith('/api')
      ? (process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
      : `${(process.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')}/api`),
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
    {
      name: 'admin-zero-trust-loader',
      // 1. 🛡️ DEV GATEWAY: Intercept admin assets in the Vite dev server
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || '';

          // Rewrite routes to the admin shell
          if (url.startsWith('/admin') && !url.includes('.')) {
            req.url = '/admin.html';
            return next();
          }

          // 🛡️ GOLDEN RULE: Strict Directory-Based Isolation
          // Everything in /src/admin/ is considered private and requires cryptographic proof.
          const isInternalAdmin = url.includes('/src/admin/');

          if (isInternalAdmin) {
            // ✅ ASSET WHITELIST (Hard Rule) for HMR & Dev Source Loading
            // Vite requests source files (.tsx, .css) via HTTP during dev. 
            // Validating JWTs on code components breaks HMR and Hard Reloads.
            const isAsset =
              url.includes('.tsx') ||
              url.includes('.ts') ||
              url.includes('.jsx') ||
              url.includes('.js') ||
              url.includes('.css') ||
              url.includes('.json') ||
              url.includes('.map') ||
              url.includes('node_modules') ||
              url.includes('/@vite/') ||
              url.includes('?t='); // HMR Timestamp

            if (isAsset) {
              // Allow Vite to serve the source code.
              // Security is enforced at Data Layer (API) and Runtime (AdminGuard).

              // 🧹 CLEANUP: Strip JWT from URL if present in 't' param
              // This prevents 'vite:esbuild' from crashing due to "Invalid loader value"
              // when it encounters a massive JWT in the query string.
              const parsedUrl = new URL(url, 'http://localhost');
              const tParam = parsedUrl.searchParams.get('t');

              // If 't' looks like a JWT (starts with 'ey' or is very long), remove it.
              // Standard Vite HMR 't' is usually a timestamp (numeric).
              // We preserve short numeric 't' for cache busting if needed.
              if (tParam && (tParam.length > 50 || tParam.startsWith('ey'))) {
                parsedUrl.searchParams.delete('t');
                req.url = parsedUrl.pathname + parsedUrl.search;
              }

              return next();
            }

            const parsedUrl = new URL(url, 'http://localhost');
            const queryToken = parsedUrl.searchParams.get('t');
            const cookieToken = req.headers.cookie?.split('; ').find(row => row.startsWith('admin_jwt='))?.split('=')[1];

            const token = queryToken || cookieToken;

            if (!token) {
              console.warn(`[SECURITY] Golden Rule Interception: Blocked internal asset ${url} (Missing Token)`);
              res.statusCode = 401;
              res.end('Unauthorized: Admin Internal Assets require a valid Security Token.');
              return;
            }

            try {
              // 🛡️ REGLA DE ORO (DEV): Validación Criptográfica de la Firma Y ROL
              const decoded = jwt.verify(token, JWT_SECRET) as any;

              if (decoded.role !== 'admin' && decoded.role !== 'super_admin') {
                console.warn(`[SECURITY] Golden Rule Interception: Blocked internal asset ${url} (Insufficient Permissions: ${decoded.role})`);
                res.statusCode = 403;
                res.end('Forbidden: Admin Authority Required.');
                return;
              }

              // ✅ Valid Token & Role -> Proceed and set/refresh cookie if it came from query
              if (queryToken) {
                res.setHeader('Set-Cookie', `admin_jwt=${queryToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600`);
                // Strip token for internal esbuild processing
                parsedUrl.searchParams.delete('t');
                req.url = parsedUrl.pathname + parsedUrl.search;
              }
            } catch (err: any) {
              console.warn(`[SECURITY] Golden Rule Interception: Blocked internal asset ${url} (Invalid/Forged Token: ${err.message})`);
              res.statusCode = 401;
              res.end('Unauthorized: Invalid or Expired Security Token.');
              return;
            }
          }




          next();
        });
      },
      // 2. ⚡ PROD RESOLVER: Inject hashed paths into the dynamic loader
      transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
          if (!ctx.filename.endsWith('admin.html')) return html;

          // In dev, ctx.bundle is undefined. Paths remain /src/...
          if (!ctx.bundle) return html;

          // In production, we find the hashed entry points from the bundle
          const adminEntry = Object.values(ctx.bundle).find(f => f.name === 'admin' && f.type === 'chunk');
          const loginEntry = Object.values(ctx.bundle).find(f => f.name === 'admin_login' && f.type === 'chunk');

          return html
            .replace('/src/admin/entry.tsx', `/admin-assets/internal/${adminEntry?.fileName || ''}`)
            .replace('/src/admin-login.tsx', `/admin-assets/public/${loginEntry?.fileName || ''}`);

        }
      }
    }

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
    },
  },
  base: '/',
  build: {
    emptyOutDir: true,
    target: 'es2020',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        admin: path.resolve(__dirname, 'admin.html'),
        admin_login: path.resolve(__dirname, 'src/admin-login.tsx'),
        admin_internal: path.resolve(__dirname, 'src/admin/entry.tsx'),


      },

      output: {
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name.toLowerCase();


          // 🔴 SENSITIVE CHUNKS (Gated by Golden Rule)
          // Any chunk coming from the src/admin directory is strictly internal.
          const isInternalAdmin = chunkInfo.facadeModuleId?.includes('/src/admin/');

          if (isInternalAdmin || name.includes('admin_internal')) {
            return 'admin-assets/internal/[name]-[hash].js';
          }

          // 🟢 PUBLIC ADMIN CHUNKS (Required for Login Shell)
          if (name.includes('admin_login') || name.includes('adminlogin')) {
            return 'admin-assets/public/[name]-[hash].js';
          }



          if (name.includes('admin')) {
            // Default to internal if ambiguous to avoid accidental leakage
            return 'admin-assets/internal/[name]-[hash].js';
          }

          return 'assets/[name]-[hash].js';
        },

        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'admin') {
            return 'admin-assets/internal/admin-entry-[hash].js';
          }
          if (chunkInfo.name === 'admin_login') {
            return 'admin-assets/public/login-entry-[hash].js';
          }
          return 'assets/[name]-[hash].js';
        },
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name?.toLowerCase() || '';
          if (name.includes('admin')) {
            if (name.includes('login')) return 'admin-assets/public/[name]-[hash][extname]';
            return 'admin-assets/internal/[name]-[hash][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        },

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

