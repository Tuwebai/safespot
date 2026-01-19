import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import App from './App.tsx'
import './index.css'
import { BootstrapErrorBoundary } from './components/BootstrapErrorBoundary'
import { IdentityInitializer } from './components/IdentityInitializer'
import { HelmetProvider } from 'react-helmet-async'

// ============================================
// ENTERPRISE SECURE BOOT (CACHE HYGIENE)
// ============================================

// Aumentar esta versión fuerza un "Hard Reset" en todos los clientes
// Útil para romper loops infinitos, estructuras de datos corruptas o bugs de skeleton.
const CACHE_SCHEMA_VERSION = 'safespot_v2_secure_boot_1.0';

(function secureBoot() {
  try {
    const currentVersion = localStorage.getItem('CACHE_SCHEMA_VERSION');

    if (currentVersion !== CACHE_SCHEMA_VERSION) {
      console.warn(`[SecureBoot] ⚠️ Detectado cambio de versión (${currentVersion} -> ${CACHE_SCHEMA_VERSION}). Ejecutando limpieza profunda...`);

      // 1. Nuke LocalStorage (excepto claves críticas si las hubiera, hoy borramos todo para seguridad)
      localStorage.clear();

      // 2. Nuke SessionStorage
      sessionStorage.clear();

      // 3. Marcar nueva versión
      localStorage.setItem('CACHE_SCHEMA_VERSION', CACHE_SCHEMA_VERSION);

      // 4. Purgar Service Workers Antiguos (Zombie Killer)
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(registrations => {
          for (const registration of registrations) {
            console.log('[SecureBoot] 💀 Desregistrando SW zombie:', registration);
            registration.unregister();
          }
          // Forzar recarga para asegurar que el nuevo SW tome control limpio
          // Solo si acabamos de desregistrar algo, para evitar loops si no había nada
          if (registrations.length > 0) {
            console.log('[SecureBoot] 🔄 Recargando para aplicar cambios limpios...');
            window.location.reload();
          }
        });
      }

      console.log('[SecureBoot] ✅ Limpieza completada. Sistema listo.');
    } else {
      console.log(`[SecureBoot] ✅ Sistema verificado (v: ${CACHE_SCHEMA_VERSION})`);
    }
  } catch (e) {
    console.error('[SecureBoot] ❌ Error crítico durante el inicio:', e);
    // Fallback: Si falla el boot, intentamos seguir, pero logueamos fuerte.
  }
})();

// Enterprise Protocol: Observability

// Enterprise Protocol: Observability
import { initSentry } from './lib/sentry'
// Initialize ASAP
initSentry();

// ============================================
// SERVICE WORKER REGISTRATION (NON-BLOCKING)
// ============================================

// Register Service Worker OUTSIDE of async block to avoid timing issues
// This runs independently of React rendering
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('[SW] Registered:', registration);

        // CRITICAL FIX: Force update check on every load
        // This ensures new SW is detected immediately after deploy
        registration.update();

        // Check for updates every 60 seconds
        // Ensures users get updates within 1 minute of deploy
        setInterval(() => {
          registration.update();
        }, 60 * 1000);
      })
      .catch(error => {
        console.warn('[SW] Registration failed:', error);
        // Non-critical - app works without SW
      });
  });

  // CRITICAL FIX: Handle Controller Change (Standard SW lifecycle)
  // This event fires when the new SW takes control (clients.claim())
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[SW] Controller changed. Reloading...');

    // PROTECTION: Prevent infinite loops if SW keeps claiming controlling
    if (sessionStorage.getItem('sw_refreshed_ts')) {
      const lastRefresh = parseInt(sessionStorage.getItem('sw_refreshed_ts') || '0');
      if (Date.now() - lastRefresh < 10000) {
        console.warn('[SW] Loop detected. Aborting reload.');
        return;
      }
    }

    sessionStorage.setItem('sw_refreshed_ts', String(Date.now()));
    window.location.reload();
  });

  // Keep FORCE_RELOAD as backup signal
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'FORCE_RELOAD') {
      // logic handled by controllerchange usually, but keeping as fallback
      // merely logging here to trace
      console.log('[SW] Received FORCE_RELOAD signal');
    }
  });
}


// ============================================
// REACT MOUNT (SYNCHRONOUS - PHASE 2)
// ============================================

/**
 * ENTERPRISE FIX: Synchronous Bootstrap
 * 
 * React mounts IMMEDIATELY without waiting for any async operations.
 * Identity initialization happens in parallel via IdentityInitializer component.
 * 
 * This ensures the app ALWAYS renders, even if:
 * - IndexedDB is corrupted
 * - Storage is disabled
 * - Network is offline
 * - Any subsystem fails
 * 
 * Fail-open architecture: App mounts → Shows UI → Initializes in background
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BootstrapErrorBoundary>
      <IdentityInitializer>
        <HelmetProvider>
          <QueryClientProvider client={queryClient}>
            <App />
          </QueryClientProvider>
        </HelmetProvider>
      </IdentityInitializer>
    </BootstrapErrorBoundary>
  </React.StrictMode>
);

console.log('[Bootstrap] ✅ React mounted synchronously');

