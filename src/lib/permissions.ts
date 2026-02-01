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

import { getAnonymousIdSafe } from '@/lib/identity';
import { useAuthStore } from '@/store/authStore';
import { sessionAuthority } from '@/engine/session/SessionAuthority';
import type { Report, Comment } from '@/lib/schemas';

/**
 * Obtiene el ID canónico del usuario actual (SessionAuthority > Auth Store > Device Fallback).
 * Esta es la identidad contra la cual se comparan los recursos.
 */
export function getCurrentUserId(): string {
    // 1. Prioridad: SessionAuthority (Motor 2 SSOT)
    const sessionId = sessionAuthority.getAnonymousId();
    if (sessionId) return sessionId;

    // 2. Fallback: Auth Store (Legacy / Durante transición)
    const auth = useAuthStore.getState();
    if (auth.token && auth.user?.auth_id) {
        return auth.user.auth_id;
    }

    // 3. Última instancia: Identidad local (Anónimo puro)
    return getAnonymousIdSafe();
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
