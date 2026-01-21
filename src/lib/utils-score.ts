/**
 * Genera un score determinístico (estable) basado en un string (ID).
 * Evita el flickering en listas virtualizadas causado por Math.random().
 * Rango: 60-95
 */
const FALLBACK_SCORE = 75;

/**
 * Genera un score determinístico (estable) basado en un string (ID).
 * Evita el flickering en listas virtualizadas causado por Math.random().
 * Rango: 60-95
 * 
 * @param id - Identificador único del reporte (puede ser undefined en creación)
 * @returns number - SafeScore calculado o fallback
 */
export function getDeterministicScore(id?: string | null): number {
    // 1. Contract Guard: Si no hay ID (creación optimistic), devolver fallback estable
    if (!id || typeof id !== 'string') {
        // TODO: Log to Sentry { event: 'SAFESCORE_INVALID_INPUT', payload: { id } }
        return FALLBACK_SCORE;
    }

    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        const char = id.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }

    // Normalizar a positivo
    const positiveHash = Math.abs(hash);

    // Mapear al rango 60-95
    return (positiveHash % 36) + 60;
}
