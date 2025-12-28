/**
 * Georef Argentina Reverse Geocoding Service
 * 
 * Uses the official Argentina Georef API to normalize locations.
 * API Documentation: https://apis.datos.gob.ar/georef/api/
 * 
 * Features:
 * - Reverse geocoding (lat/lng → province, locality, department)
 * - Simple in-memory cache to reduce API calls
 * - Graceful fallback on API errors
 */

import { logError, logSuccess } from './logger.js';

// Georef API endpoint
const GEOREF_API_BASE = 'https://apis.datos.gob.ar/georef/api';

// Simple cache to avoid repeated API calls for same coordinates
// Key: "lat,lng" (rounded to 4 decimals), Value: { data, timestamp }
const locationCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours (locations don't change)
const MAX_CACHE_SIZE = 1000;

/**
 * Normalize coordinates to cache key (round to ~11m precision)
 */
function coordsToKey(lat, lng) {
    return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

/**
 * Check cache for location data
 */
function getCached(lat, lng) {
    const key = coordsToKey(lat, lng);
    const cached = locationCache.get(key);

    if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
        return cached.data;
    }

    return null;
}

/**
 * Store location data in cache
 */
function setCache(lat, lng, data) {
    // Prevent unbounded cache growth
    if (locationCache.size >= MAX_CACHE_SIZE) {
        // Remove oldest entry
        const firstKey = locationCache.keys().next().value;
        locationCache.delete(firstKey);
    }

    const key = coordsToKey(lat, lng);
    locationCache.set(key, { data, timestamp: Date.now() });
}

/**
 * Reverse geocode coordinates using Georef API
 * Returns province, locality (municipio), and department info
 * 
 * @param {number} latitude - Latitude in decimal degrees
 * @param {number} longitude - Longitude in decimal degrees
 * @returns {Promise<{province: string|null, locality: string|null, department: string|null}>}
 */
export async function reverseGeocode(latitude, longitude) {
    // Validate inputs
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return { province: null, locality: null, department: null };
    }

    // Check Argentina bounds (approximate)
    if (latitude < -55.1 || latitude > -21.8 || longitude < -73.6 || longitude > -53.6) {
        logError(new Error('Coordinates outside Argentina bounds'), { latitude, longitude });
        return { province: null, locality: null, department: null };
    }

    // Check cache first
    const cached = getCached(latitude, longitude);
    if (cached) {
        return cached;
    }

    try {
        // Call Georef API
        const url = `${GEOREF_API_BASE}/ubicacion?lat=${latitude}&lon=${longitude}`;

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'SafeSpot-App/1.0'
            },
            // Timeout after 5 seconds
            signal: AbortSignal.timeout(5000)
        });

        if (!response.ok) {
            throw new Error(`Georef API returned ${response.status}`);
        }

        const data = await response.json();

        // Extract location data
        const result = {
            province: data.ubicacion?.provincia?.nombre || null,
            locality: data.ubicacion?.municipio?.nombre || null,
            department: data.ubicacion?.departamento?.nombre || null
        };

        // Cache the result
        setCache(latitude, longitude, result);

        logSuccess('Georef reverse geocode', {
            latitude,
            longitude,
            province: result.province
        });

        return result;

    } catch (error) {
        // Log error but don't fail - return nulls
        logError(error, { context: 'georef.reverseGeocode', latitude, longitude });

        // Return empty result (graceful degradation)
        return { province: null, locality: null, department: null };
    }
}

/**
 * Batch reverse geocode multiple coordinates
 * Uses the POST endpoint for efficiency
 * 
 * @param {Array<{lat: number, lng: number, id: string}>} coordinates
 * @returns {Promise<Map<string, {province: string|null, locality: string|null}>>}
 */
export async function batchReverseGeocode(coordinates) {
    const results = new Map();

    if (!coordinates || coordinates.length === 0) {
        return results;
    }

    try {
        // Georef POST endpoint for batch queries
        const url = `${GEOREF_API_BASE}/ubicacion`;

        const body = {
            ubicaciones: coordinates.map(coord => ({
                lat: coord.lat,
                lon: coord.lng
            }))
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'SafeSpot-App/1.0'
            },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(10000)
        });

        if (!response.ok) {
            throw new Error(`Georef batch API returned ${response.status}`);
        }

        const data = await response.json();

        // Map results back to IDs
        if (data.resultados && Array.isArray(data.resultados)) {
            data.resultados.forEach((result, index) => {
                const coord = coordinates[index];
                if (coord && result.ubicacion) {
                    results.set(coord.id, {
                        province: result.ubicacion.provincia?.nombre || null,
                        locality: result.ubicacion.municipio?.nombre || null,
                        department: result.ubicacion.departamento?.nombre || null
                    });

                    // Cache each result
                    setCache(coord.lat, coord.lng, {
                        province: result.ubicacion.provincia?.nombre || null,
                        locality: result.ubicacion.municipio?.nombre || null,
                        department: result.ubicacion.departamento?.nombre || null
                    });
                }
            });
        }

        return results;

    } catch (error) {
        logError(error, { context: 'georef.batchReverseGeocode' });
        return results;
    }
}

/**
 * Get province name for coordinates (simplified helper)
 * Returns null if not in Argentina or API fails
 * 
 * @param {number} latitude
 * @param {number} longitude
 * @returns {Promise<string|null>}
 */
export async function getProvince(latitude, longitude) {
    const result = await reverseGeocode(latitude, longitude);
    return result.province;
}

/**
 * Clear the location cache (for testing)
 */
export function clearCache() {
    locationCache.clear();
}
