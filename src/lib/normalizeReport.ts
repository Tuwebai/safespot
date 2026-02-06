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
    fullAddress: string       // Enterprise standard: Calle N°, Barrio, Ciudad, Provincia
    isOfficial: boolean       // UI indicator for staff/official accounts
    role: string              // User role (citizen, official, moderator)
    _isOptimistic?: boolean   // Flag to prevent premature fetching
}

/**
 * Normalize a Report for UI consumption
 * Guarantees all derived fields are present and valid
 */
export function normalizeReportForUI(report: Report): NormalizedReport {
    // 🛡️ SECURITY & SSOT: Always rely on author object
    // ADAPTER LAYER guarantees author.id exists for active users.
    // 'DELETED_USER' representa un usuario que fue eliminado (dato histórico válido).
    const DELETED_USER_MARKER = 'DELETED_USER' as const;
    const safeAuthorId = report.author?.id || DELETED_USER_MARKER;
    const isDeletedUser = safeAuthorId === DELETED_USER_MARKER;
    // Explicitly check for 'Anónimo' string or falsy values
    const authorAlias = report.author?.alias;
    const isAnonymousAlias = authorAlias === 'Anónimo' || !authorAlias;

    // Enterprise address formatting: Calle N°, Barrio, Ciudad, Provincia
    // Backend format: N°,Calle,Barrio,Ciudad,Localidad,Provincia,CP
    const parts = (report.address || '').split(',').map(p => p.trim());
    let formattedAddress = '';

    if (parts.length >= 2) {
        const nro = parts[0];
        const calle = parts[1];
        const barrio = parts[2] || '';
        const ciudad = parts[3] || report.locality || '';
        const provincia = parts[5] || report.province || '';

        formattedAddress = `${calle} ${nro}${barrio ? `, ${barrio}` : ''}${ciudad ? `, ${ciudad}` : ''}${provincia ? `, ${provincia}` : ''}`;
    } else {
        // Fallback if not standard CSV
        formattedAddress = report.address || report.zone || 'Ubicación detectada';
    }

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
        fullAddress: formattedAddress,
        isOfficial: report.author?.is_official ?? false,
        role: report.author?.role ?? 'citizen',
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
