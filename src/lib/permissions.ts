/**
 * PERMISSIONS & OWNERSHIP (SSOT)
 * 
 * Centralized logic for determining user capabilities based on identity.
 * Replaces ad-hoc checks scattered across components.
 * 
 * INVARIANTS:
 * 1. Owner is determined by STRICT equality of author.id.
 * 2. Permissions are derived PURELY from the entity + identity state.
 * 3. No UI logic here, only Business Logic.
 */

import { sessionAuthority } from '@/engine/session/SessionAuthority';
import type { Report, Comment } from '@/lib/schemas';

/**
 * Obtiene el ID canónico del usuario actual (SSOT: SessionAuthority única fuente).
 * 
 * ⚠️ INVARIANTE: Solo SessionAuthority provee identidad.
 * Para usuarios autenticados, retorna authId. Para anónimos, anonymousId.
 * 
 * @returns string ID del usuario (auth si existe, sino anonymous), o '' si no hay identidad
 */
export function getCurrentUserId(): string {
    // ✅ SSOT v3: SessionAuthority tiene toda la identidad
    const identity = sessionAuthority.getToken();
    if (!identity) return '';
    
    // Si está autenticado, usar authId. Sino, anonymousId.
    return identity.authId || identity.anonymousId;
}

/**
 * Checks if the current user is the owner of an entity.
 * Uses getCurrentUserId() as the SSOT for current user identity.
 * Adapts to new Strict Model where ID is in 'author.id'
 */
export function isOwner(entity: { author: { id: string } } | null | undefined): boolean {
    if (!entity || !entity.author || !entity.author.id) return false;

    const currentId = getCurrentUserId();
    // Strict comparison
    return entity.author.id === currentId;
}


// ============================================
// REPORTS
// ============================================

export function canEditReport(report: Report | null | undefined): boolean {
    // Only owner can edit
    // (Add Mod logic here in future if needed)
    return isOwner(report);
}

export function canDeleteReport(report: Report | null | undefined): boolean {
    // Only owner can delete
    return isOwner(report);
}

// ============================================
// COMMENTS
// ============================================

export function canEditComment(comment: Comment | null | undefined): boolean {
    return isOwner(comment);
}

export function canDeleteComment(comment: Comment | null | undefined): boolean {
    return isOwner(comment);
}

// ============================================
// MODERATION (Flags)
// ============================================

/**
 * Validates if the current user can view moderation actions
 */
export function canFlag(entity: { author: { id: string } } | null | undefined): boolean {
    // Cannot flag your own content
    return !isOwner(entity);
}
