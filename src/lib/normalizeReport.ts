import type { Report } from './schemas'

/**
 * UI Normalization Layer
 * 
 * Pre-computes all derived fields to ensure components NEVER do defensive logic.
 * This is the ONLY place where .substring(), fallbacks, and data transformation happen.
 */

export interface NormalizedReport extends Report {
    // Pre-computed UI fields (NEVER undefined)
    shortId: string           // First 6 chars of anonymous_id for display
    displayAuthor: string     // "@alias" or "Usuario {shortId}"
    avatarFallback: string    // First 2 chars of anonymous_id for avatar
    formattedDate: string     // Formatted created_at
}

/**
 * Normalize a Report for UI consumption
 * Guarantees all derived fields are present and valid
 */
export function normalizeReportForUI(report: Report): NormalizedReport {
    // 🛡️ DEFENSIVE CODING: Handle deleted/missing users
    // Ensure anonymous_id has minimum length (fallback to ID if empty)
    const safeAnonymousId = report.anonymous_id || report.id || 'unknown'

    // 🛡️ Check if this report has a deleted/missing author
    // If anonymous_id is 'unknown' or if critical user data is missing, mark as deleted
    const isDeletedUser = !report.anonymous_id || safeAnonymousId === 'unknown'

    return {
        ...report,
        // Pre-computed fields for UI
        shortId: safeAnonymousId.substring(0, 6),
        avatarFallback: isDeletedUser ? '?' : safeAnonymousId.substring(0, 2).toUpperCase(),
        displayAuthor: isDeletedUser
            ? 'Usuario eliminado'
            : report.alias
                ? `@${report.alias}`
                : `Usuario ${safeAnonymousId.substring(0, 6)}`,
        formattedDate: formatDate(report.created_at)
    }
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
