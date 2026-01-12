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
      })
      .catch(error => {
        console.warn('[SW] Registration failed:', error);
        // Non-critical - app works without SW
      });
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

