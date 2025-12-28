/**
 * Cursor Pagination Utilities
 */

/**
 * Encode cursor object to Base64 string
 * @param {Object} cursorObj - { created_at, id }
 * @returns {string} Base64 encoded cursor
 */
export function encodeCursor(cursorObj) {
    if (!cursorObj) return null;
    return Buffer.from(JSON.stringify(cursorObj)).toString('base64');
}

/**
 * Decode Base64 cursor string to object
 * @param {string} cursorStr - Base64 encoded cursor
 * @returns {Object|null} { created_at, id } or null if invalid
 */
export function decodeCursor(cursorStr) {
    if (!cursorStr) return null;
    try {
        const jsonStr = Buffer.from(cursorStr, 'base64').toString('utf-8');
        return JSON.parse(jsonStr);
    } catch (e) {
        return null;
    }
}
