/**
 * Anonymous Identity Module (V2)
 * 
 * Robust multi-layer persistence for anonymous_id:
 * 1. LocalStorage (Primary/Legacy)
 * 2. Browsers Cookies (Resilient to storage clearing)
 * 3. IndexedDB (Robust backup)
 * 
 * Includes a consensus algorithm to recover identity if one or two layers fall.
 */

// ============================================
// CONSTANTS & CONFIG
// ============================================

const L1_KEY = 'safespot_anonymous_id'; // Legacy & primary
const L2_KEY = 'ss_anon_id';           // Cookie key
const L3_DB = 'SafespotIdentity';      // IndexedDB Name
const ID_VERSION = 'v1';               // Format versioning

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
  const rawId = uuid.includes('|') ? uuid.split('|')[1] : uuid;
  return UUID_V4_REGEX.test(rawId);
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
  // ENTERPRISE FIX: Dual timeout to prevent infinite hangs
  // Outer timeout: 1000ms hard limit for entire operation
  const globalTimeout = new Promise<null>((resolve) => {
    setTimeout(() => {
      console.warn('[Identity] IndexedDB get timeout (1000ms)');
      resolve(null);
    }, 1000);
  });

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

  return Promise.race([operation, globalTimeout]);
}

async function setIDB(key: string, value: string): Promise<void> {
  // ENTERPRISE FIX: Dual timeout matching getIDB pattern
  const globalTimeout = new Promise<void>((resolve) => {
    setTimeout(() => {
      console.warn('[Identity] IndexedDB set timeout (1000ms)');
      resolve();
    }, 1000);
  });

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

  return Promise.race([operation, globalTimeout]);
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
  // If we have it in LocalStorage or Cookies, use it IMMEDIATELY.
  // Do not wait for IndexedDB (which can be slow/blocked).
  const l1 = localStorage.getItem(L1_KEY);
  const l2 = getCookie(L2_KEY);

  let winner: string | null = null;

  // Prefer L1, then L2
  if (l1 && isValidUUID(l1)) {
    winner = l1.includes('|') ? l1.split('|')[1] : l1;
  } else if (l2 && isValidUUID(l2)) {
    winner = l2.includes('|') ? l2.split('|')[1] : l2;
  }

  // If found in sync layers, we are good to go.
  // Trigger background sync to L3 (IDB) for redundancy, but don't block.
  if (winner) {
    cachedId = winner;
    console.log('[Identity] Found existing ID (Sync):', winner);

    // Background sync
    (async () => {
      try {
        const versionedId = `${ID_VERSION}|${winner}`;
        if (l1 !== winner) localStorage.setItem(L1_KEY, winner);
        if (l2 !== versionedId) setCookie(L2_KEY, versionedId);
        await setIDB('current_id', versionedId);
      } catch (e) { /* ignore */ }
    })();

    return winner;
  }

  // 2. SLOW PATH: If not in sync layers, check IndexedDB (L3)
  console.log('[Identity] Not found in Sync layers, checking IDB...');

  // ENTERPRISE FIX: Reduced timeout from 500ms to 300ms for aggressive fail-fast
  const timeoutPromise = new Promise<string | null>((resolve) => {
    setTimeout(() => {
      console.warn('[Identity] IDB check timeout (300ms) - generating new ID');
      resolve(null);
    }, 300);
  });

  const idbPromise = getIDB('current_id');
  const l3 = await Promise.race([idbPromise, timeoutPromise]);

  if (l3 && isValidUUID(l3)) {
    winner = l3.includes('|') ? l3.split('|')[1] : l3;
    console.log('[Identity] ✅ Recovered from IDB:', winner);
  } else {
    // 3. GENERATION: Absolute loss, generate new
    winner = generateUUID();
    console.log('[Identity] ✨ Generated NEW ID:', winner);
  }

  // 4. Persist Winner to all layers
  cachedId = winner;
  const versionedId = `${ID_VERSION}|${winner}`;

  try {
    localStorage.setItem(L1_KEY, winner);
    setCookie(L2_KEY, versionedId);
    setIDB('current_id', versionedId).catch(() => { });
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
  if (cachedId) return cachedId;

  // Last resort sync read from LocalStorage
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem(L1_KEY);
    if (isValidUUID(stored)) {
      // Clean prefix if it somehow leaked into storage (paranoid check)
      const cleanId = stored.includes('|') ? stored.split('|')[1] : stored;
      cachedId = cleanId;
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
    return id.includes('|') ? id.split('|')[1] : id;
  }

  // If we get here and it was never initialized, this is an emergency
  const emergencyId = generateUUID();
  cachedId = emergencyId;
  return emergencyId;
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

  const cleanId = newId.includes('|') ? newId.split('|')[1] : newId;
  cachedId = cleanId;
  const versionedId = `${ID_VERSION}|${cleanId}`;

  localStorage.setItem(L1_KEY, cleanId);
  setCookie(L2_KEY, versionedId);
  await setIDB('current_id', versionedId);
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
  if (typeof window === 'undefined') return;
  localStorage.removeItem(L1_KEY);
  document.cookie = `${L2_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  indexedDB.deleteDatabase(L3_DB);
}

