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

  // CRITICAL FIX: Handle FORCE_RELOAD message from SW
  // When SW updates, it sends this message to force clients to reload
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'FORCE_RELOAD') {
      console.log('[SW] Force reload requested by new SW version');

      // CIRCUIT BREAKER: Prevent infinite reload loops
      // We check if we just reloaded for this exact reason

      if (sessionStorage.getItem('sw_pending_reload')) {
        console.warn('[SW] Reload loop detected. Aborting force reload.');
        sessionStorage.removeItem('sw_pending_reload'); // Clear for next valid attempt
        return;
      }

      // Mark that we are reloading intentionally
      sessionStorage.setItem('sw_pending_reload', 'true');

      // Reload safely
      window.location.reload();
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

