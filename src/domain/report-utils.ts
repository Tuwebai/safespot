
/**
 * SafeSpot Report Domain Utilities
 * Separates business logic from UI components.
 */

export const URGENT_CATEGORIES = [
    { id: 'Robo', label: 'Robo', icon: '🚨' },
    { id: 'Accidente', label: 'Accidente', icon: '🚑' },
    { id: 'Sospechoso', label: 'Sospechoso', icon: '👀' },
    { id: 'Violencia', label: 'Violencia', icon: '👊' },
] as const;

export type UrgentCategory = typeof URGENT_CATEGORIES[number]['id'];

/**
 * Builds a standardized title for urgent reports.
 * Prevents hardcoded strings in UI components.
 * 
 * @param category - The selected category (e.g., 'Robo')
 * @returns A formatted string (e.g., "🚨 Reporte Urgente: Robo")
 */
export function buildUrgentTitle(category: string): string {
    return `🚨 Reporte Urgente: ${category}`;
}

/**
 * Returns a default description for urgent reports when the user
 * doesn't provide one (speed priority).
 */
export function buildUrgentDescription(category: string): string {
    return `Reporte de emergencia generado rápidamente para la categoría ${category}. Se requiere atención inmediata.`;
}

/**
 * Determines if a zone string is valid or should be treated as empty.
 * Used to sanitize the 'zone' field before sending to API.
 */
export function sanitizeZone(zone?: string | null): string {
    if (!zone || zone === 'current' || zone === 'unknown') {
        return ''; // Let backend calculate it
    }
    return zone;
}
