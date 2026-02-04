/**
 * Helper to normalize status values from legacy clients
 */
export function normalizeStatus(status) {
    if (!status) return undefined;
    const map = {
        'pendiente': 'abierto',
        'en_proceso': 'en_progreso',
        'cerrado': 'archivado'
    };
    return map[status] || status;
}
