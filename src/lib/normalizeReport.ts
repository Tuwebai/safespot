import type { Report } from './schemas';


/**
 * UI Normalization Layer
 * 
 * Pre-computes all derived fields to ensure components NEVER do defensive logic.
 * This is the ONLY place where .substring(), fallbacks, and data transformation happen.
 */

export interface NormalizedReport extends Report {
    // Pre-computed UI fields (NEVER undefined)
    shortId: string           // First 6 chars of author.id for display
    displayAuthor: string     // "@alias" or "Usuario {shortId}"
    avatarFallback: string    // First 2 chars of author.id for avatar
    formattedDate: string     // Formatted created_at
    authorAlias: string       // Flat alias for UI
    authorAvatar: string      // Flat avatar URL
    createdAt: string         // Original created_at preserved
    latitude: number | null
    longitude: number | null
    zoneName: string          // Flat zone name fallback
    _isOptimistic?: boolean   // Flag to prevent premature fetching
}

/**
 * Normalize a Report for UI consumption
 * Guarantees all derived fields are present and valid
 */
export function normalizeReportForUI(report: Report): NormalizedReport {
    // 🛡️ SECURITY & SSOT: Always rely on author object
    // ADAPTER LAYER guarantees author.id exists.
    const safeAuthorId = report.author?.id || 'unknown'
    const isDeletedUser = safeAuthorId === 'unknown'
    // Explicitly check for 'Anónimo' string or falsy values
    const authorAlias = report.author?.alias;
    const isAnonymousAlias = authorAlias === 'Anónimo' || !authorAlias;

    return {
        ...report,
        // Pre-computed fields for UI
        shortId: safeAuthorId.substring(0, 6),
        avatarFallback: isDeletedUser ? '?' : safeAuthorId.substring(0, 2).toUpperCase(),
        displayAuthor: isDeletedUser
            ? 'Usuario eliminado'
            : !isAnonymousAlias
                ? `@${authorAlias}`
                : `Usuario ${safeAuthorId.substring(0, 6)}`,
        formattedDate: formatDate(report.created_at),
        authorAlias: isDeletedUser ? 'Usuario' : (authorAlias || 'Anónimo'),
        authorAvatar: report.author?.avatarUrl || '',
        createdAt: report.created_at,
        latitude: report.latitude ? Number(report.latitude) : null,
        longitude: report.longitude ? Number(report.longitude) : null,
        zoneName: report.zone || 'Zona detectada',
        _isOptimistic: report._isOptimistic // ✅ EXPLICIT PRESERVATION
    };
}

/**
 * Format date for display
 * ✅ MEDIUM #12 FIX: Visible fallback for invalid dates
 */
function formatDate(dateString: string): string {
    try {
        const date = new Date(dateString)

        // ✅ Explicit validation
        if (isNaN(date.getTime())) {
            return 'Fecha inválida'
        }

        return date.toLocaleDateString('es-AR', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        })
    } catch (e) {
        return 'Fecha inválida'
    }
}
