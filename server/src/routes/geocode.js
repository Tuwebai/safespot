import express from 'express';
import { logError, logSuccess } from '../utils/logger.js';
import { validate } from '../utils/validateMiddleware.js';
import { geocodeSearchSchema, reverseGeocodeSchema } from '../utils/schemas.js';

const router = express.Router();

// Rate limiting map: IP -> { count, resetTime }
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 1000; // 1 second
const MAX_REQUESTS_PER_WINDOW = 5;

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
 */
router.get('/search', validate(geocodeSearchSchema, 'query'), async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        // Rate limiting (internal)
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Demasiadas solicitudes. Esperá un segundo e intentá de nuevo.'
            });
        }

        const { q, limit, countrycodes } = req.query;

        const searchQuery = q;
        const resultLimit = limit;
        const countryCodes = countrycodes;

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
 * Helper: Fetch from Georef AR (Official Argentine Data)
 */
async function fetchGeoref(lat, lon, signal) {
    try {
        const url = `https://apis.datos.gob.ar/georef/api/ubicacion?lat=${lat}&lon=${lon}`;
        const response = await fetch(url, { signal });

        if (!response.ok) return null;

        const data = await response.json();

        if (!data.ubicacion) return null;

        // Normalize
        const prov = data.ubicacion.provincia?.nombre;
        const muni = data.ubicacion.municipio?.nombre; // Municipio (e.g. Río Tercero)
        const depto = data.ubicacion.departamento?.nombre; // Departamento (e.g. Tercero Arriba)

        // Priority for City: Municipio > Departamento
        // Note: Georef sometimes returns 'null' string or actual null
        let city = (muni && muni !== 'null') ? muni : depto;

        // Final fallback: If city is still null (e.g. some rural areas), uses Province to avoid 'null, Province'
        if (!city || city === 'null') {
            city = prov;
        }

        if (!prov) return null; // If no province, it's likely not useful or outside AR logic

        return {
            source: 'georef',
            lat: Number(data.ubicacion.lat),
            lon: Number(data.ubicacion.lon),
            address: {
                city: city,
                province: prov,
                country: 'Argentina', // Georef is AR only
                state: prov, // Alias for compatibility
                municipality: muni,
                county: depto
            },
            display_name: `${city ? city + ', ' : ''}${prov}, Argentina`
        };
    } catch (e) {
        return null;
    }
}

/**
 * GET /api/geocode/reverse
 * Reverse geocoding (coordinates to address)
 * Strategy: Georef AR (Primary) -> Nominatim OSM (Fallback)
 */
router.get('/reverse', validate(reverseGeocodeSchema, 'query'), async (req, res) => {
    try {
        const clientIp = req.ip || req.connection.remoteAddress || 'unknown';

        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Demasiadas solicitudes. Esperá un segundo e intentá de nuevo.'
            });
        }

        const { lat, lon } = req.query;
        // Ensure lat/lon are within Argentina approximate bounds to decide if we try Georef first?
        // Rough bounds: Lat -21 to -55, Lon -53 to -73. 
        // Optimization: Try Georef always, it fails fast for outside coords.

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s total timeout

        let result = null;

        // 1. Try Georef AR
        try {
            result = await fetchGeoref(lat, lon, controller.signal);
        } catch (e) {
            console.warn('[Geocode] Georef failed, falling back...');
        }

        // 2. Fallback to Nominatim if Georef failed or returned no data
        if (!result) {
            try {
                const nominatimUrl = new URL('https://nominatim.openstreetmap.org/reverse');
                nominatimUrl.searchParams.set('lat', lat.toString());
                nominatimUrl.searchParams.set('lon', lon.toString());
                nominatimUrl.searchParams.set('format', 'json');
                nominatimUrl.searchParams.set('addressdetails', '1');
                nominatimUrl.searchParams.set('accept-language', 'es-AR,es;q=0.9');

                const nomResponse = await fetch(nominatimUrl.toString(), {
                    headers: {
                        'User-Agent': 'SafeSpot/1.0 (contact@safespot.app)',
                        'Accept': 'application/json'
                    },
                    signal: controller.signal
                });

                if (nomResponse.ok) {
                    const nomData = await nomResponse.json();

                    // Normalize Nominatim
                    const addr = nomData.address || {};
                    const city = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || addr.suburb || addr.county;
                    const province = addr.state || addr.region || addr.province;

                    result = {
                        source: 'nominatim',
                        lat: nomData.lat,
                        lon: nomData.lon,
                        display_name: nomData.display_name,
                        address: {
                            ...addr,
                            city,
                            province
                        }
                    };
                }
            } catch (e) {
                console.error('[Geocode] Nominatim fallback failed:', e);
            }
        }

        clearTimeout(timeoutId);

        if (!result) {
            // Both failed
            return res.status(502).json({
                error: 'GEOCODE_ERROR',
                message: 'No pudimos determinar la ubicación.'
            });
        }

        res.json({
            success: true,
            data: result
        });

    } catch (error) {
        logError(error, req);
        res.status(500).json({
            error: 'INTERNAL_ERROR',
            message: 'Error interno al obtener la dirección'
        });
    }
});

/**
 * GET /api/geocode/ip
 * IP-based geolocation fallback
 * Used when GPS permission is denied or fails.
 */
router.get('/ip', async (req, res) => {
    try {
        let clientIp = req.ip || req.connection.remoteAddress || '';

        // Handle localhost/private IPs by resolving REAL Public IP
        // Enterprise Solution: Never mock, resolve the actual developer location.
        if (clientIp === '::1' || clientIp === '127.0.0.1' || clientIp.includes('192.168.')) {
            try {
                // 1. Get Public IP of the server/dev machine
                const ipResponse = await fetch('https://api.ipify.org?format=json');
                if (ipResponse.ok) {
                    const ipData = await ipResponse.json();
                    clientIp = ipData.ip; // Use real public IP for the next step
                    console.log(`[Geocode] 🌍 Localhost detected. Resolved Public IP: ${clientIp}`);
                } else {
                    throw new Error('Could not resolve public IP');
                }
            } catch (e) {
                console.warn('Failed to resolve public IP for localhost, using fallback');
                // Only use static fallback if we literally can't get internet access
                return res.json({
                    success: true,
                    data: {
                        source: 'ip_fallback_dev',
                        lat: -34.6037,
                        lon: -58.3816,
                        display_name: 'Buenos Aires, Argentina (Dev Fallback)',
                        address: {
                            city: 'Buenos Aires',
                            province: 'Buenos Aires',
                            country: 'Argentina'
                        }
                    }
                });
            }
        }

        // Fix for proxies (e.g. Netlify/Vercel)
        if (req.headers['x-forwarded-for']) {
            clientIp = req.headers['x-forwarded-for'].split(',')[0].trim();
        }

        // Rate limit check
        if (!checkRateLimit(clientIp)) {
            return res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Demasiadas solicitudes.'
            });
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        let data = null;
        let provider = 'ipapi';

        try {
            // 1. Try ipapi.co (HTTPS, Reliable)
            const response = await fetch(`https://ipapi.co/${clientIp}/json/`, {
                signal: controller.signal,
                headers: { 'User-Agent': 'SafeSpot/1.0' }
            });
            if (response.ok) {
                const json = await response.json();
                if (!json.error) {
                    data = {
                        lat: json.latitude,
                        lon: json.longitude,
                        city: json.city,
                        region: json.region, // Province
                        country: json.country_name
                    };
                }
            }
        } catch (e) {
            console.warn('[Geocode] ipapi.co failed, trying fallback...', e.message);
        }

        // 2. Fallback: ip-api.com (HTTP, Fast, lenient)
        if (!data) {
            try {
                // ip-api.com doesn't support HTTPS on free tier, but server-to-server HTTP is fine
                const fallbackResponse = await fetch(`http://ip-api.com/json/${clientIp}?fields=status,message,country,regionName,city,lat,lon`);
                if (fallbackResponse.ok) {
                    const json = await fallbackResponse.json();
                    if (json.status === 'success') {
                        provider = 'ip-api';
                        data = {
                            lat: json.lat,
                            lon: json.lon,
                            city: json.city,
                            region: json.regionName,
                            country: json.country
                        };
                    }
                }
            } catch (e) {
                console.error('[Geocode] ip-api.com fallback failed:', e.message);
            }
        }

        clearTimeout(timeoutId);

        if (!data) {
            throw new Error('All IP Geo providers failed');
        }

        // Normalize
        // Ensure City is present. If city is missing/generic, use Region.
        const city = data.city || data.region;
        const region = data.region || data.city;

        res.json({
            success: true,
            data: {
                source: `ip_${provider}`,
                lat: data.lat,
                lon: data.lon,
                display_name: `${city}, ${region}, ${data.country}`,
                address: {
                    city: city,
                    province: region,
                    country: data.country
                }
            }
        });

    } catch (error) {
        logError(error, req);
        // Fallback for IP failure? We really can't do much else without input.
        res.status(502).json({
            error: 'IP_GEO_ERROR',
            message: 'No pudimos detectar tu ubicación por IP.'
        });
    }
});

export default router;
