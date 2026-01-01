import express from 'express';
import { logError, logSuccess } from '../utils/logger.js';
import { validateCoordinates } from '../utils/validation.js';

const router = express.Router();

// Rate limiting map: IP -> { count, resetTime }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const MAX_REQUESTS_PER_WINDOW = 1;

/**
 * Simple in-memory rate limiter
 * Allows 1 request per second per IP
 */
function checkRateLimit(ip) {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record) {
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (now > record.resetTime) {
        // Window expired, reset
        rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_LIMIT_WINDOW_MS });
        return true;
    }

    if (record.count >= MAX_REQUESTS_PER_WINDOW) {
        return false;
    }

    record.count++;
    return true;
}

/**
 * GET /api/geocode/search
 * Proxy for Nominatim geocoding search
 * 
 * Query params:
 * - q: search query (required)
 * - limit: max results (default 5, max 10)
 * - countrycodes: comma-separated country codes (optional, default 'ar')
 * 
 * Why this solves the mobile issue:
 * - Nominatim blocks direct browser requests from mobile (User-Agent detection)
 * - CORS headers are inconsistent on mobile browsers
 * - Backend proxy has stable User-Agent and no CORS restrictions
 */
router.get('/search', async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        // Rate limiting
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Demasiadas solicitudes. Esperá un segundo e intentá de nuevo.'
            });
        }

        const { q, limit, countrycodes } = req.query;

        // Validation
        if (!q || typeof q !== 'string' || q.trim().length === 0) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: 'El parámetro "q" (query) es requerido'
            });
        }

        const searchQuery = q.trim();
        const resultLimit = Math.min(10, Math.max(1, parseInt(limit, 10) || 5));
        const countryCodes = countrycodes || 'ar';

        // Build Nominatim URL
        const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
        nominatimUrl.searchParams.set('q', searchQuery);
        nominatimUrl.searchParams.set('format', 'json');
        nominatimUrl.searchParams.set('limit', resultLimit.toString());
        nominatimUrl.searchParams.set('addressdetails', '1');
        nominatimUrl.searchParams.set('countrycodes', countryCodes);

        // Call Nominatim with proper User-Agent
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5s timeout

        let nominatimResponse;
        try {
            nominatimResponse = await fetch(nominatimUrl.toString(), {
                headers: {
                    'User-Agent': 'SafeSpot/1.0 (contact@safespot.app)', // CRITICAL: Valid User-Agent
                    'Accept': 'application/json',
                    'Accept-Language': 'es-AR,es;q=0.9'
                },
                signal: controller.signal
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                logError(new Error('Nominatim timeout'), req);
                return res.status(504).json({
                    error: 'GEOCODE_TIMEOUT',
                    message: 'El servicio de búsqueda tardó demasiado. Intentá de nuevo.'
                });
            }

            throw fetchError;
        }

        clearTimeout(timeoutId);

        // Handle Nominatim errors
        if (!nominatimResponse.ok) {
            logError(new Error(`Nominatim returned ${nominatimResponse.status}`), req);

            if (nominatimResponse.status === 403) {
                return res.status(503).json({
                    error: 'GEOCODE_BLOCKED',
                    message: 'El servicio de búsqueda no está disponible temporalmente.'
                });
            }

            return res.status(502).json({
                error: 'GEOCODE_ERROR',
                message: 'Error al buscar la dirección. Intentá de nuevo.'
            });
        }

        const results = await nominatimResponse.json();

        // Empty results
        if (!Array.isArray(results) || results.length === 0) {
            return res.json({
                success: true,
                data: []
            });
        }

        // Transform results: only return necessary fields
        const transformedResults = results.map(result => ({
            display_name: result.display_name,
            lat: result.lat,
            lon: result.lon
        }));

        logSuccess('Geocode search', { query: searchQuery, results: transformedResults.length });

        res.json({
            success: true,
            data: transformedResults
        });

    } catch (error) {
        logError(error, req);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Error interno al buscar la dirección'
        });
    }
});

/**
 * GET /api/geocode/reverse
 * Reverse geocoding (coordinates to address)
 * 
 * Query params:
 * - lat: latitude (required)
 * - lon: longitude (required)
 */
router.get('/reverse', async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        // Rate limiting
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Demasiadas solicitudes. Esperá un segundo e intentá de nuevo.'
            });
        }

        const { lat, lon } = req.query;

        // Validation
        const latitude = Number(lat);
        const longitude = Number(lon);

        try {
            validateCoordinates(latitude, longitude);
        } catch (error) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: error.message
            });
        }

        // Build Nominatim URL
        const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
        nominatimUrl.searchParams.set('lat', latitude.toString());
        nominatimUrl.searchParams.set('lon', longitude.toString());
        nominatimUrl.searchParams.set('format', 'json');
        nominatimUrl.searchParams.set('addressdetails', '1');
        nominatimUrl.searchParams.set('countrycodes', 'ar');

        // Call Nominatim
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let nominatimResponse;
        try {
            nominatimResponse = await fetch(nominatimUrl.toString(), {
                headers: {
                    'User-Agent': 'SafeSpot/1.0 (contact@safespot.app)',
                    'Accept': 'application/json',
                    'Accept-Language': 'es-AR,es;q=0.9'
                },
                signal: controller.signal
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);

            if (fetchError.name === 'AbortError') {
                return res.status(504).json({
                    error: 'GEOCODE_TIMEOUT',
                    message: 'El servicio tardó demasiado. Intentá de nuevo.'
                });
            }

            throw fetchError;
        }

        clearTimeout(timeoutId);

        if (!nominatimResponse.ok) {
            return res.status(502).json({
                error: 'GEOCODE_ERROR',
                message: 'Error al obtener la dirección'
            });
        }

        const result = await nominatimResponse.json();

        res.json({
            success: true,
            data: {
                display_name: result.display_name || '',
                lat: result.lat,
                lon: result.lon,
                address: result.address || {}
            }
        });

    } catch (error) {
        logError(error, req);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Error interno al obtener la dirección'
        });
    }
});

export default router;
