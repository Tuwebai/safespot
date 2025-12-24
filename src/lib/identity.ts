/**
 * Anonymous Identity Module
 * Single source of truth for anonymous_id
 * Generates UUID v4 once per browser, stores in localStorage
 */

const ANONYMOUS_ID_KEY = 'safespot_anonymous_id';
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Generate a new UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Validate UUID v4 format
 */
function isValidUUID(uuid: string): boolean {
  return UUID_V4_REGEX.test(uuid);
}

/**
 * Get anonymous_id from localStorage or generate new one
 * This is the ONLY function that should be called to get anonymous_id
 * 
 * @throws {Error} If localStorage is completely unavailable (SSR or disabled)
 */
export function getAnonymousId(): string {
  if (typeof window === 'undefined') {
    throw new Error('Cannot access localStorage in SSR');
  }

  try {
    // Try to get existing ID
    const stored = localStorage.getItem(ANONYMOUS_ID_KEY);
    
    if (stored) {
      if (isValidUUID(stored)) {
        return stored;
      } else {
        // Invalid format, remove it and regenerate
        try {
          localStorage.removeItem(ANONYMOUS_ID_KEY);
        } catch (e) {
          // If we can't remove, continue to regenerate
        }
      }
    }
    
    // Generate new ID
    const newId = generateUUID();
    try {
      localStorage.setItem(ANONYMOUS_ID_KEY, newId);
    } catch (e) {
      // If we can't save, still return the ID (in-memory only)
      // This allows the app to continue functioning temporarily
    }
    return newId;
  } catch (error) {
    // If localStorage is completely unavailable, try to generate in-memory ID
    // This is a last resort - the ID won't persist but app won't crash
    const fallbackId = generateUUID();
    return fallbackId;
  }
}

/**
 * Get anonymous_id with automatic recovery and error handling
 * This function NEVER throws - it always returns a valid UUID
 * Use this for critical paths where failure is not acceptable
 * 
 * @returns {string} A valid UUID v4 anonymous_id
 */
export function getAnonymousIdSafe(): string {
  try {
    return getAnonymousId();
  } catch (error) {
    // Last resort: generate a new ID in memory
    // This ensures the app never breaks due to ID issues
    const emergencyId = generateUUID();
    
    // Try one more time to save it
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ANONYMOUS_ID_KEY, emergencyId);
      } catch (e) {
        // If we still can't save, return in-memory ID
      }
    }
    
    return emergencyId;
  }
}

/**
 * Initialize anonymous identity
 * Must be called before any API calls
 * Returns the anonymous_id
 * This function ensures the anonymous_id is ready before any data fetching
 * Uses safe version that never fails
 */
export function initializeIdentity(): string {
  return getAnonymousIdSafe();
}

/**
 * Reset anonymous_id (for testing/debugging only)
 */
export function resetIdentity(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(ANONYMOUS_ID_KEY);
  }
}

/**
 * Validate anonymous_id format
 * Throws error if invalid
 */
export function validateAnonymousId(id: string): void {
  if (!id) {
    throw new Error('Anonymous ID is required');
  }
  
  if (typeof id !== 'string') {
    throw new Error('Anonymous ID must be a string');
  }
  
  if (!isValidUUID(id)) {
    throw new Error(`Invalid anonymous ID format: ${id}`);
  }
}

/**
 * Ensure anonymous_id exists and is valid
 * If invalid or missing, regenerates automatically
 * This function ensures we always have a valid ID
 * 
 * @returns {string} A valid UUID v4 anonymous_id
 */
export function ensureAnonymousId(): string {
  try {
    const id = getAnonymousId();
    if (isValidUUID(id)) {
      return id;
    }
  } catch (error) {
    // Fall through to regeneration
  }
  
  // If we get here, something is wrong - regenerate
  try {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ANONYMOUS_ID_KEY);
    }
  } catch (e) {
    // Ignore removal errors
  }
  
  return getAnonymousIdSafe();
}

