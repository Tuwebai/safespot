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
        localStorage.removeItem(ANONYMOUS_ID_KEY);
      }
    }
    
    // Generate new ID
    const newId = generateUUID();
    localStorage.setItem(ANONYMOUS_ID_KEY, newId);
    return newId;
  } catch (error) {
    throw new Error('Failed to access localStorage for anonymous_id');
  }
}

/**
 * Initialize anonymous identity
 * Must be called before any API calls
 * Returns the anonymous_id
 * This function ensures the anonymous_id is ready before any data fetching
 */
export function initializeIdentity(): string {
  try {
    const id = getAnonymousId();
    return id;
  } catch (error) {
    throw new Error('Failed to initialize anonymous identity. Please check localStorage access.');
  }
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

