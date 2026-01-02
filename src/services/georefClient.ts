/**
 * Client-side service for interacting with Georef AR API
 * Documentation: https://apis.datos.gob.ar/georef/api/
 */

const GEOREF_API_BASE = 'https://apis.datos.gob.ar/georef/api';

export interface AddressSuggestion {
    original: string;
    normalized: string;
    location: {
        lat: number;
        lng: number;
    };
    province: string;
    locality: string;
}

/**
 * Search for addresses (autocomplete)
 * @param query Address query string (e.g. "Av Corrientes 1000")
 * @param limit Max results (default 5)
 */
export async function searchAddresses(query: string, limit = 5): Promise<AddressSuggestion[]> {
    if (!query || query.length < 3) return [];

    try {
        const params = new URLSearchParams({
            direccion: query,
            max: limit.toString(),
        });

        const response = await fetch(`${GEOREF_API_BASE}/direcciones?${params.toString()}`);
        if (!response.ok) throw new Error('Georef API error');

        const data = await response.json();

        if (!data.direcciones) return [];

        return data.direcciones.map((item: any) => ({
            original: item.nomenclatura,
            normalized: item.nomenclatura, // In Georef, nomenclatura is practically the normalized string
            location: {
                lat: item.ubicacion.lat,
                lng: item.ubicacion.lon,
            },
            province: item.provincia.nombre,
            locality: item.localidad_censal.nombre || item.departamento.nombre,
        }));
    } catch (error) {
        console.warn('Georef search error:', error);
        return [];
    }
}

/**
 * Reverse geocode a location
 * @param lat Latitude
 * @param lng Longitude
 */
export async function reverseGeocode(lat: number, lng: number): Promise<AddressSuggestion | null> {
    try {
        const response = await fetch(`${GEOREF_API_BASE}/ubicacion?lat=${lat}&lon=${lng}`);
        if (!response.ok) throw new Error('Georef API error');

        const data = await response.json();
        if (!data.ubicacion) return null;

        return {
            original: `${data.ubicacion.municipio?.nombre || ''}, ${data.ubicacion.provincia?.nombre || ''}`,
            normalized: `${data.ubicacion.municipio?.nombre || ''}, ${data.ubicacion.provincia?.nombre || ''}`,
            location: { lat, lng },
            province: data.ubicacion.provincia?.nombre,
            locality: data.ubicacion.municipio?.nombre || data.ubicacion.departamento?.nombre,
        };
    } catch (error) {
        console.warn('Georef reverse error:', error);
        return null;
    }
}
