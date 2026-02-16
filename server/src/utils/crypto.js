import crypto from 'crypto';
import { getJwtSecret } from './env.js';

const SECRET = getJwtSecret();

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

    try {
        const expected = signAnonymousId(anonymousId);

        // ✅ HARDENING: Validate buffer lengths BEFORE timingSafeEqual
        // timingSafeEqual throws "Input buffers must have the same byte length" if lengths differ
        // This happens when frontend sends legacy random signatures (~15 chars) vs HMAC-SHA256 (64 chars)
        const signatureBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expected);

        if (signatureBuffer.length !== expectedBuffer.length) {
            // Legacy signature detected (different length than HMAC-SHA256)
            return false;
        }

        return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch (error) {
        // ✅ DEFENSIVE: Catch any unexpected errors (e.g., invalid encoding)
        // Never crash the API due to signature validation
        console.error('[CRYPTO] Signature verification failed:', error.message);
        return false;
    }
}
