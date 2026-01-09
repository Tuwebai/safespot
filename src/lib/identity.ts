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
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(L3_DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('identity');
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('identity', 'readonly');
        const store = transaction.objectStore('identity');
        const getReq = store.get(key);
        getReq.onsuccess = () => resolve(getReq.result as string || null);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

async function setIDB(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(L3_DB, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('identity');
      };
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction('identity', 'readwrite');
        const store = transaction.objectStore('identity');
        store.put(value, key);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
      };
      request.onerror = () => resolve();
    } catch (e) {
      resolve();
    }
  });
}

// ============================================
// CORE LOGIC
// ============================================

let cachedId: string | null = null;

/**
 * Resolve identity using multi-layer consensus.
 * Called during app initialization.
 */
export async function initializeIdentity(): Promise<string> {
  if (cachedId) return cachedId;
  if (typeof window === 'undefined') return '';

  // 1. Read all layers (with timeout to prevent hang)
  const timeoutPromise = new Promise<{ l1: string | null, l2: string | null, l3: string | null }>((resolve) => {
    setTimeout(() => resolve({ l1: null, l2: null, l3: null }), 1000);
  });

  const loadLayersPromise = async () => {
    const l1 = localStorage.getItem(L1_KEY);
    const l2 = getCookie(L2_KEY);
    const l3 = await getIDB('current_id');
    return { l1, l2, l3 };
  };

  const { l1, l2, l3 } = await Promise.race([loadLayersPromise(), timeoutPromise]);

  // 2. Identify candidates (removing version prefix if any)
  const candidates = [l1, l2, l3]
    .filter((id): id is string => id !== null && isValidUUID(id))
    .map(id => id.includes('|') ? id.split('|')[1] : id);

  let winner: string;

  if (candidates.length > 0) {
    // Consensus: Find the most frequent ID
    const frequency: Record<string, number> = {};
    let maxFreq = 0;
    let fallbackWinner = candidates[0];

    candidates.forEach(id => {
      frequency[id] = (frequency[id] || 0) + 1;
      if (frequency[id] > maxFreq) {
        maxFreq = frequency[id];
        fallbackWinner = id;
      }
    });

    winner = fallbackWinner; // The most persistent ID wins
    console.log('[Identity] Recovered ID:', winner);
  } else {
    // Absolute loss: Generate new
    winner = generateUUID();
    console.log('[Identity] Generated NEW ID:', winner);
  }

  // 3. Normalize and Broadcast (Synchronization) - Force Restore to all layers
  // This ensures if LocalStorage was cleared but Cookie remained, LocalStorage gets fixed.
  cachedId = winner;
  const versionedId = `${ID_VERSION}|${winner}`;

  try {
    // FORCE WRITE TO ALL LAYERS immediately
    if (l1 !== winner) localStorage.setItem(L1_KEY, winner);
    if (l2 !== versionedId) setCookie(L2_KEY, versionedId);
    // Always try to write DB to be safe
    setIDB('current_id', versionedId).catch(e => console.error('[Identity] IDB Write failed', e));

    // Double check: If we just generated a new one, ensure it sticks
    if (candidates.length === 0) {
      localStorage.setItem(L1_KEY, winner);
      setCookie(L2_KEY, versionedId);
    }

  } catch (e) {
    console.debug('[Identity] Failed to sync all layers', e);
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

/** Reset identity (Testing only) */
export function resetIdentity(): void {
  cachedId = null;
  if (typeof window === 'undefined') return;
  localStorage.removeItem(L1_KEY);
  document.cookie = `${L2_KEY}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  indexedDB.deleteDatabase(L3_DB);
}

