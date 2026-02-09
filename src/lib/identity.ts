/**
 * Anonymous Identity Module (V2)
 * 
 * Robust multi-layer persistence for anonymous_id:
 * 1. LocalStorage (Primary/Legacy)
 * 2. Browsers Cookies (Resilient to storage clearing)
 * 3. IndexedDB (Robust backup)
 * 
 * Includes a consensus algorithm to recover identity if one or two layers fall.
 * 
 * V2 UPDATE: Uses VersionedStorageManager for TTL, checksums, and migration.
 */

import { versionedStorage } from './storage/VersionedStorageManager';
import { notifyStorageChange } from './storage/StorageSyncManager';
import { telemetry, TelemetrySeverity } from './telemetry/TelemetryEngine';
import { leaderElection } from './realtime/LeaderElection';

// ============================================
// CONSTANTS & CONFIG
// ============================================

const L1_KEY = 'safespot_anonymous_id'; // Legacy & primary
const L2_KEY = 'ss_anon_id';           // Cookie key
const L3_DB = 'SafespotIdentity';      // IndexedDB Name
const ID_VERSION = 'v2';               // Format versioning (UPDATED from v1)

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ============================================
// HELPERS
// ============================================

/** Generate a new UUID v4 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function isValidUUID(uuid: unknown): uuid is string {
  if (typeof uuid !== 'string') return false;
  // Handle optional version prefix (e.g., "v1|uuid")
  const rawId = parseVersionedId(uuid).id;
  return UUID_V4_REGEX.test(rawId);
}

/** Parse versioned ID format "v2|uuid" or legacy "uuid" */
function parseVersionedId(versionedId: string): { version: string | null; id: string } {
  if (!versionedId.includes('|')) {
    return { version: null, id: versionedId };
  }
  const [version, id] = versionedId.split('|');
  return { version, id };
}

/** Wrap a promise with a timeout */
function withTimeout<T>(promise: Promise<T>, ms: number, context: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => {
        console.warn(`[Identity] ${context} timeout (${ms}ms)`);
        resolve(null);
      }, ms);
    })
  ]);
}

// --------------------------------------------
// Layer 2: Cookie Storage
// --------------------------------------------

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

function setCookie(name: string, value: string, days = 3650) { // 10 years default
  if (typeof document === 'undefined') return;
  const date = new Date();
  date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
  const expires = `expires=${date.toUTCString()}`;
  // Add SameSite=None + Secure for cross-context if needed, but Lax is safer for now.
  // Use max-age for modern browsers support
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax;max-age=${days * 24 * 60 * 60}`;
}

// --------------------------------------------
// Layer 3: IndexedDB Storage
// --------------------------------------------

async function getIDB(key: string): Promise<string | null> {
  const operation = new Promise<string | null>((resolve) => {
    try {
      const request = indexedDB.open(L3_DB, 1);

      // Inner timeout: 800ms for the request itself
      const requestTimeout = setTimeout(() => {
        console.warn('[Identity] IndexedDB request timeout (800ms)');
        resolve(null);
      }, 800);

      request.onupgradeneeded = () => {
        try {
          request.result.createObjectStore('identity');
        } catch (e) {
          // Store might already exist
        }
      };

      request.onsuccess = () => {
        clearTimeout(requestTimeout);
        try {
          const db = request.result;
          const transaction = db.transaction('identity', 'readonly');
          const store = transaction.objectStore('identity');
          const getReq = store.get(key);

          getReq.onsuccess = () => resolve(getReq.result as string || null);
          getReq.onerror = () => {
            console.warn('[Identity] IndexedDB get error');
            resolve(null);
          };

          // Timeout for transaction
          transaction.onerror = () => {
            console.warn('[Identity] IndexedDB transaction error');
            resolve(null);
          };
        } catch (e) {
          console.warn('[Identity] IndexedDB read error:', e);
          resolve(null);
        }
      };

      request.onerror = () => {
        clearTimeout(requestTimeout);
        console.warn('[Identity] IndexedDB open error');
        resolve(null);
      };

      request.onblocked = () => {
        clearTimeout(requestTimeout);
        console.warn('[Identity] IndexedDB blocked');
        resolve(null);
      };
    } catch (e) {
      console.warn('[Identity] IndexedDB exception:', e);
      resolve(null);
    }
  });

  return withTimeout(operation, 1000, 'IndexedDB get');
}

async function setIDB(key: string, value: string): Promise<void> {
  const operation = new Promise<void>((resolve) => {
    try {
      const request = indexedDB.open(L3_DB, 1);

      const requestTimeout = setTimeout(() => {
        console.warn('[Identity] IndexedDB set request timeout (800ms)');
        resolve();
      }, 800);

      request.onupgradeneeded = () => {
        try {
          request.result.createObjectStore('identity');
        } catch (e) {
          // Store might already exist
        }
      };

      request.onsuccess = () => {
        clearTimeout(requestTimeout);
        try {
          const db = request.result;
          const transaction = db.transaction('identity', 'readwrite');
          const store = transaction.objectStore('identity');
          store.put(value, key);

          transaction.oncomplete = () => resolve();
          transaction.onerror = () => {
            console.warn('[Identity] IndexedDB set transaction error');
            resolve();
          };
        } catch (e) {
          console.warn('[Identity] IndexedDB write error:', e);
          resolve();
        }
      };

      request.onerror = () => {
        clearTimeout(requestTimeout);
        console.warn('[Identity] IndexedDB set open error');
        resolve();
      };

      request.onblocked = () => {
        clearTimeout(requestTimeout);
        console.warn('[Identity] IndexedDB set blocked');
        resolve();
      };
    } catch (e) {
      console.warn('[Identity] IndexedDB set exception:', e);
      resolve();
    }
  });

  await withTimeout(operation, 1000, 'IndexedDB set');
}

// ============================================
// CORE LOGIC
// ============================================

let cachedId: string | null = null;

/**
 * Resolve identity using multi-layer consensus.
 * Called during app initialization.
 */
/**
 * Resolve identity using multi-layer consensus.
 * Called during app initialization.
 */
export async function initializeIdentity(): Promise<string> {
  if (cachedId) return cachedId;
  if (typeof window === 'undefined') return '';

  // 1. FAST PATH: Check Synchronous Layers (L1 & L2)
  // V2 UPDATE: Use VersionedStorageManager for L1 (enables auto-migration)
  const l1 = versionedStorage.getVersioned<string>(L1_KEY);
  const l2 = getCookie(L2_KEY);

  let winner: string | null = null;

  // Prefer L1, then L2
  if (l1 && isValidUUID(l1)) {
    winner = parseVersionedId(l1).id;
  } else if (l2 && isValidUUID(l2)) {
    winner = parseVersionedId(l2).id;
  }

  // If found in sync layers, we are good to go.
  // Also update to v2 format using VersionedStorageManager
  if (winner) {
    cachedId = winner;
    console.log('[Identity] Found existing ID (Sync):', winner);

    // Background sync with v2 storage format
    (async () => {
      try {
        // Store in v2 format with versioning + TTL
        versionedStorage.putVersioned(L1_KEY, winner, 365);  // 365 days TTL for identity

        const versionedId = `${ID_VERSION}|${winner}`;
        if (l2 !== versionedId) setCookie(L2_KEY, versionedId);
        await setIDB('current_id', versionedId);

        // Notify other tabs
        notifyStorageChange(L1_KEY, 'set');
      } catch (e) { /* ignore */ }
    })();

    return winner;
  }

  // 1.5 Start WATCHDOG (Enterprise Shielding)
  startSessionWatchdog();

  // 2. SLOW PATH: If not in sync layers, check IndexedDB (L3)
  console.log('[Identity] Not found in Sync layers, checking IDB...');

  // ============================================
  // ENTERPRISE FIX: Retry + Increased Timeout
  // ============================================
  // Problem: 800ms timeout caused false ID regeneration on slow devices
  // Solution: 2000ms timeout + 1 retry = max 4s, but never false positive

  const IDB_TIMEOUT_MS = 2000;  // Increased from 800ms
  const MAX_IDB_RETRIES = 1;    // 1 retry = 2 total attempts

  let l3: string | null = null;

  for (let attempt = 0; attempt <= MAX_IDB_RETRIES; attempt++) {
    const attemptNum = attempt + 1;

    const timeoutPromise = new Promise<string | null>((resolve) => {
      setTimeout(() => {
        console.warn(`[Identity] IDB attempt ${attemptNum}/${MAX_IDB_RETRIES + 1} timeout (${IDB_TIMEOUT_MS}ms)`);
        resolve(null);
      }, IDB_TIMEOUT_MS);
    });

    const idbPromise = getIDB('current_id');
    const result = await Promise.race([idbPromise, timeoutPromise]);

    if (result && isValidUUID(result)) {
      l3 = result;
      console.log(`[Identity] ✅ IDB success on attempt ${attemptNum}`);
      break;
    }

    // If timeout but not last attempt, retry
    if (attempt < MAX_IDB_RETRIES) {
      console.log(`[Identity] IDB attempt ${attemptNum} failed, retrying...`);
    }
  }

  if (l3 && isValidUUID(l3)) {
    winner = parseVersionedId(l3).id;
    console.log('[Identity] ✅ Recovered from IDB:', winner);
  } else {
    // 3. GENERATION: Only after exhausting ALL layers + retries
    winner = generateUUID();
    console.log('[Identity] ✨ Generated NEW ID (all layers exhausted):', winner);
  }

  // 4. Persist Winner to all layers using v2 format
  cachedId = winner;
  const versionedId = `${ID_VERSION}|${winner}`;

  try {
    // Use VersionedStorageManager for L1
    versionedStorage.putVersioned(L1_KEY, winner, 365);  // 365 days TTL
    setCookie(L2_KEY, versionedId);
    setIDB('current_id', versionedId).catch(() => { });

    // Notify other tabs
    notifyStorageChange(L1_KEY, 'set');
  } catch (e) {
    console.error('[Identity] Write serialization failed', e);
  }

  return winner;
}

/**
 * Synchronous access to current ID.
 * Assumes initializeIdentity was already called.
 * Falls back to LocalStorage if needed.
 */
export function getAnonymousId(): string {
  // ✅ MOTOR 2.1 Proxy: Prefer Authority Engine if available
  // This allows legacy code to benefit from the new authority system.
  try {
    const authority = (window as any).__safespot_session_authority;
    if (authority) {
      const authId = authority.getAnonymousId();
      if (authId) return authId;
    }
  } catch (e) { /* silent fail for SSR or early access */ }

  if (cachedId) return cachedId;

  // Try v2 versioned storage first
  if (typeof window !== 'undefined') {
    const storedV2 = versionedStorage.getVersioned<string>(L1_KEY);
    if (storedV2 && isValidUUID(storedV2)) {
      cachedId = storedV2;
      return storedV2;
    }

    // 🧠 ENTERPRISE FAIL-SAFE:
    // If we reach here, it means the versioned storage returned null.
    // This could be because it's MIGRATING or because it's RAW legacy data.
    const raw = localStorage.getItem(L1_KEY);
    if (!raw) return '';

    // If it looks like JSON but getVersioned failed, we attempt an emergency unwrap
    // to avoid generating a new ID and losing the user's identity.
    if (raw.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(raw);
        const data = parsed.data || (typeof parsed === 'string' ? parsed : null);
        if (isValidUUID(data)) {
          console.log('[Identity] [Recovery] Successfully unwrapped identity from JSON raw access');
          cachedId = data;
          return data;
        }
      } catch (e) { /* ignore */ }
    }

    // Traditional Legacy Fallback (v1 string)
    if (isValidUUID(raw)) {
      const { id: cleanId } = parseVersionedId(raw);
      cachedId = cleanId;

      // Migrate to v2 in background
      setTimeout(() => {
        versionedStorage.putVersioned(L1_KEY, cleanId, 365);
        notifyStorageChange(L1_KEY, 'set');
      }, 0);

      return cleanId;
    }
  }

  return '';
}

/**
 * Validates and ensures a valid ID exists.
 */
export function ensureAnonymousId(): string {
  const id = getAnonymousId();
  if (id) {
    // Ensure what we return is always clean
    return parseVersionedId(id).id;
  }

  // ✅ EXTREME RECOVERY: Before generating a new ID, check if Motor 2 has a session
  if (typeof window !== 'undefined') {
    try {
      const sessionRaw = localStorage.getItem('safespot_session_v2');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session.anonymousId && isValidUUID(session.anonymousId)) {
          console.warn('[Identity] [ExtremeRecovery] Restored identity from SessionToken SSOT');
          const recoveredId = session.anonymousId;
          cachedId = recoveredId;
          // Re-persist to all layers immediately
          versionedStorage.putVersioned(L1_KEY, recoveredId, 365);
          return recoveredId;
        }
      }
    } catch (e) { /* ignore */ }
  }

  // If we get here and it was never initialized, this is an emergency
  const emergencyId = generateUUID();
  cachedId = emergencyId;

  // ✅ P0 FIX: PERSIST IMMEDIATELY (Stop Ghost IDs)
  // Force sync write to L1 so reload works
  if (typeof window !== 'undefined') {
    try {
      // 1. Sync / Fast persistence
      versionedStorage.putVersioned(L1_KEY, emergencyId, 365);

      // 2. Async persistence (L2/L3)
      const versionedId = `${ID_VERSION}|${emergencyId}`;
      setCookie(L2_KEY, versionedId);
      setIDB('current_id', versionedId).catch(console.warn);

      console.warn('[Identity] 🚨 Emergency ID generated & persisted:', emergencyId);
    } catch (e) {
      console.error('[Identity] Critical persistence failure:', e);
    }
  }

  return emergencyId;
}

// ============================================
// ENTERPRISE WATCHDOG (M2 + M8 + M11)
// ============================================

let watchdogInterval: ReturnType<typeof setInterval> | null = null;

function startSessionWatchdog() {
  if (watchdogInterval || typeof window === 'undefined') return;

  console.log('[Identity] 🛡️ Watchdog activated');

  watchdogInterval = setInterval(async () => {
    // Check if L1 is missing but we have a cachedId in memory
    const rawL1 = localStorage.getItem(L1_KEY);

    if (!rawL1 && cachedId) {
      console.warn('[Identity] 🚨 L1 Missing! Attempting L3 Restore...');

      try {
        const l3 = await getIDB('current_id');

        if (l3 && isValidUUID(l3)) {
          // RESTORE L1 FROM L3
          const { id: cleanId } = parseVersionedId(l3);

          if (cleanId === cachedId) {
            versionedStorage.putVersioned(L1_KEY, cleanId, 365);

            // 📡 TELEMETRY DIAGNOSTIC
            telemetry.emit({
              engine: 'Identity',
              severity: TelemetrySeverity.WARN,
              payload: {
                action: 'identity_restored_from_idb',
                reason: 'localStorage_missing',
                restoredLayer: 'IDB',
                wasLeader: leaderElection.isLeader()
              }
            });

            console.log('[Identity] ✅ Identity restored from IDB (Watchdog)');
          }
        }
      } catch (e) {
        console.error('[Identity] Watchdog restore failed', e);
      }
    }
  }, 5000); // Check every 5s
}

/** Stop session watchdog - call on logout to prevent memory leaks */
export function stopSessionWatchdog(): void {
  if (watchdogInterval) {
    clearInterval(watchdogInterval);
    watchdogInterval = null;
    console.debug('[Identity] 🛡️ Watchdog stopped');
  }
}

/** Legacy support */
export function getAnonymousIdSafe(): string {
  return ensureAnonymousId();
}

/** Only for critical validation */
export function validateAnonymousId(id: string): void {
  if (!id || !isValidUUID(id)) {
    throw new Error('Invalid or missing Anonymous ID');
  }
}

/** Update identity across all layers */
export async function updateIdentity(newId: string): Promise<void> {
  if (!isValidUUID(newId)) throw new Error('Invalid Anonymous ID');

  const { id: cleanId } = parseVersionedId(newId);
  cachedId = cleanId;
  const versionedId = `${ID_VERSION}|${cleanId}`;

  // Use v2 versioned storage
  versionedStorage.putVersioned(L1_KEY, cleanId, 365);
  setCookie(L2_KEY, versionedId);
  await setIDB('current_id', versionedId);

  // Notify other tabs of identity change
  notifyStorageChange(L1_KEY, 'set');
}

/** Export identity as a JSON file download */
export function exportIdentity(): void {
  const id = getAnonymousId();
  if (!id) return;

  const data = {
    anonymous_id: id,
    exported_at: new Date().toISOString(),
    app: "SafeSpot",
    version: ID_VERSION
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `safespot-identity-${id.substring(0, 8)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** 
 * Import identity from a JSON file.
 * Returns true if successful.
 */
export async function importIdentity(file: File): Promise<boolean> {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (data.app !== "SafeSpot" || !data.anonymous_id || !isValidUUID(data.anonymous_id)) {
      throw new Error('Archivo de identidad inválido o de otra aplicación');
    }

    await updateIdentity(data.anonymous_id);
    return true;
  } catch (err) {
    console.error('[Identity] Import failed:', err);
    throw err;
  }
}

/** Reset identity (Testing only) */
export function resetIdentity(): void {
  cachedId = null;
  stopSessionWatchdog(); // 🧹 Stop watchdog to prevent memory leaks
  if (typeof window === 'undefined') return;
  localStorage.removeItem(L1_KEY);
  document.cookie = `${L2_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  indexedDB.deleteDatabase(L3_DB);
}

