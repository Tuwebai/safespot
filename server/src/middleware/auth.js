
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';
import { ErrorCodes } from '../utils/errorCodes.js';
import { getJwtSecret } from '../utils/env.js';

const JWT_SECRET = getJwtSecret();

/**
 * Auth Middleware
 * Unifies the identity pipeline:
 * 1. Checks for Bearer Token.
 * 2. If valid, injects anonymous_id from token into headers (Identity Promotion).
 * 3. STRICT MODE: If token is present but invalid -> 401 Unauthorized (No fallback).
 */
export function validateAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    let token = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.query && req.query.token) {
        // Support for SSE / EventSource which can't send headers
        token = req.query.token;
    }

    if (token) {
        try {
            const decoded = jwt.verify(token, JWT_SECRET);

            // ANTI-SPOOFING & IDENTITY PROMOTION
            // We force the server to respect the identity claimed by the token.
            // We OVERWRITE the header to ensure downstream components trust the verified identity.
            if (decoded.anonymous_id || decoded.id) {
                const effectiveAnonId = decoded.anonymous_id || decoded.id;
                req.headers['x-anonymous-id'] = effectiveAnonId;
                req.user = {
                    auth_id: decoded.auth_id || decoded.id,
                    anonymous_id: effectiveAnonId,
                    email: decoded.email,
                    avatar_url: decoded.avatar_url,
                    role: decoded.role || 'citizen' // ✅ Critical for Operator Mode
                };
            }
        } catch (err) {
            console.warn('[Auth] Invalid Token Rejected:', err.message);
            // STRICT SECURITY: If a token is provided, it MUST be valid.
            // We do NOT allow falling back to x-anonymous-id if the user attempted auth and failed.
            // DANGER: Falling back would allow an attacker to send a bad token + a victim's anon_id.
            return next(new AppError('Sesion invalida o expirada', 401, ErrorCodes.INVALID_TOKEN, true));
        }
    }

    next();
}

/**
 * Helper to sign tokens
 */
export function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

