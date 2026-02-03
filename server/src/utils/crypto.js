import crypto from 'crypto';

const SECRET = process.env.JWT_SECRET || 'safespot-core-secret-2024-change-me';

/**
 * Sign an anonymous ID using HMAC-SHA256
 * @param {string} anonymousId - UUID to sign
 * @returns {string} HMAC signature
 */
export function signAnonymousId(anonymousId) {
    return crypto
        .createHmac('sha256', SECRET)
        .update(anonymousId)
        .digest('hex');
}

/**
 * Verify if a signature matches the anonymous ID
 * @param {string} anonymousId - UUID to verify
 * @param {string} signature - HMAC signature to check
 * @returns {boolean} True if valid
 */
export function verifyAnonymousSignature(anonymousId, signature) {
    if (!anonymousId || !signature) return false;
    const expected = signAnonymousId(anonymousId);
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
