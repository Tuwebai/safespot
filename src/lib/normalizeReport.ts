import type { Report } from './schemas';
import { getAuthorDisplayName } from '@/lib/adapters';

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
}

/**
 * Normalize a Report for UI consumption
 * Guarantees all derived fields are present and valid
 */
export function normalizeReportForUI(report: Report): NormalizedReport {
    // 🛡️ DEFENSIVE CODING: Handle deleted/missing users
    // Ensure id has minimum length (fallback to ID if empty)
    // ADAPTER LAYER guarantees author.id exists, but we check just in case of raw partials
    const safeAnonymousId = report.author?.id || 'unknown'

    // 🛡️ Check if this report has a deleted/missing author
    const isDeletedUser = safeAnonymousId === 'unknown'

    // Alias fallback logic using Adapter helper if available, or custom UI logic
    // Adapter sets 'Anónimo', here we might want 'Usuario {shortId}'
    // Let's preserve the existing UI logic: if alias is 'Anónimo' (from adapter) or null, show Usuario SHORT_ID?
    // Actually, adapter sets alias to 'Anónimo' if null.
    // If we want to keep "Usuario {shortId}" style, we might need to check if alias is 'Anónimo'.

    // Logic from previous version: 
    // displayAuthor: isDeletedUser ? 'Usuario eliminado' : report.alias ? `@${report.alias}` : `Usuario ${shortId}`

    // Adapter converts null alias to 'Anónimo'.
    const isAnonymousAlias = report.author.alias === 'Anónimo';

    return {
        ...report,
        // Pre-computed fields for UI
        shortId: safeAnonymousId.substring(0, 6),
        avatarFallback: isDeletedUser ? '?' : safeAnonymousId.substring(0, 2).toUpperCase(),
        displayAuthor: isDeletedUser
            ? 'Usuario eliminado'
            // If adapter says 'Anónimo', maybe we prefer 'Usuario {shortId}' for reports? 
            // Or just stick to @alias if it exists (adapter ensures it exists).
            // Let's assume Adapter's 'Anónimo' is good enough, OR emulate old behavior.
            // Old behavior: users without custom alias showed "Usuario 123456".
            // If we want that, we check if alias === 'Anónimo' (default from adapter)
            : !isAnonymousAlias
                ? `@${report.author.alias}`
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
