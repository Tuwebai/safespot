import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// ✅ ENTERPRISE: Sentry (Production Only)
import { initSentry } from './lib/sentry'
initSentry()

import { AppVersion } from './lib/version'
import { telemetryHub } from './lib/telemetry/TelemetryHub'

// ✅ ENTERPRISE LOGGING: Identity
console.info(
  `%cSafeSpot v${AppVersion.appVersion}%c\nDeploy: ${AppVersion.deployId.substring(0, 19)} | Build: ${AppVersion.buildHash}`,
  'background: #00ff88; color: #000; padding: 4px; font-weight: bold; border-radius: 4px;',
  'color: #94a3b8; margin-left: 5px;'
);

// ✅ MOTOR 8: Unified Telemetry Engine
if (import.meta.env.DEV) {
  const history = telemetryHub.getHistory();
  console.debug(`[Telemetry] Hub initialized. Current history: ${history.length} signals.`);
}

// ============================================
// ENTERPRISE SECURE BOOT (CACHE HYGIENE)
// ============================================
// CRITICAL: This runs BEFORE React mounts to ensure clean state
// Prevents stale data from corrupting the app on schema changes

const CACHE_SCHEMA_VERSION = '2.0'; // Increment to force global cache clear
const CACHE_VERSION_KEY = 'ss_cache_schema_version';

(async function secureBoot() {
  const storedVersion = localStorage.getItem(CACHE_VERSION_KEY);

  if (storedVersion !== CACHE_SCHEMA_VERSION) {
    console.warn(
      `[SecureBoot] Schema mismatch detected: ${storedVersion} → ${CACHE_SCHEMA_VERSION}. Clearing all caches...`
    );

    try {
      // 1. Unregister ALL Service Workers (nuclear option)
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
        }
        console.debug('[SecureBoot] ✅ Unregistered all Service Workers');
      }

      // 2. Clear ALL browser caches (Cache API)
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.debug('[SecureBoot] ✅ Cleared all Cache API entries');
      }

      // 3. Clear localStorage (except auth & identity)
      const authBackup = localStorage.getItem('auth-storage');
      const identityBackup = localStorage.getItem('safespot_anonymous_id');
      const sessionV2Backup = localStorage.getItem('safespot_session_v2');

      // ✅ ENTERPRISE SECURITY: Preserve Admin Session during Public App boot
      // This prevents "Session Contamination" where public app wipes admin credentials
      const adminTokenBackup = localStorage.getItem('safespot_admin_token');
      const adminUserBackup = localStorage.getItem('safespot_admin_user');

      localStorage.clear();

      if (authBackup) localStorage.setItem('auth-storage', authBackup);
      if (identityBackup) localStorage.setItem('safespot_anonymous_id', identityBackup);
      if (sessionV2Backup) localStorage.setItem('safespot_session_v2', sessionV2Backup);

      if (adminTokenBackup) localStorage.setItem('safespot_admin_token', adminTokenBackup);
      if (adminUserBackup) localStorage.setItem('safespot_admin_user', adminUserBackup);

      console.debug('[SecureBoot] ✅ Cleared localStorage (Identity & Auth preserved)');

      // 4. Clear sessionStorage
      sessionStorage.clear();
      console.debug('[SecureBoot] ✅ Cleared sessionStorage');

      // 5. Mark new schema version
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_SCHEMA_VERSION);

      // 6. Force reload to ensure fresh state
      console.log('[SecureBoot] 🔄 Reloading to apply clean state...');
      window.location.reload();
      return; // Prevent React mount
    } catch (error) {
      console.error('[SecureBoot] ❌ Error during cache clear:', error);
      // Continue anyway (fail-safe)
    }
  } else {
    // console.debug(`[SecureBoot] ✅ Schema version OK (${CACHE_SCHEMA_VERSION})`);
  }
})();

// ============================================
// REACT MOUNT
// ============================================

ReactDOM.createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// console.debug('[Bootstrap] ✅ React mounted successfully');

// ============================================
// ENTERPRISE: UPDATE MANAGER
// ============================================
// Initialize UpdateManager AFTER React mount to avoid blocking render
// UpdateManager handles silent deploy-based updates

import { updateManager } from './lib/updateManager';

if ('serviceWorker' in navigator) {
  // Delay initialization to not block initial render
  setTimeout(() => {
    updateManager.init();
    // console.debug('[Bootstrap] ✅ UpdateManager initialized');
  }, 1000);
}
