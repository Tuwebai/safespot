/**
 * resolveCreator (SSOT v3)
 * 
 * ROLE: Identity Resolution Engine for Mutations
 * RESPONSIBILITY: Resolve creator identity for optimistic updates
 * 
 * ⚠️ INVARIANTE CRÍTICA: Esta función NUNCA debe retornar un ID inválido.
 * Si no hay identidad válida, lanza IdentityInvariantViolation.
 * 
 * PRECONDICIÓN: guardIdentityReady() debe ejecutarse ANTES de llamar esta función.
 * 
 * ✅ SSOT v3: SessionAuthority es la ÚNICA fuente de verdad.
 * - anonymousId: Siempre presente en SessionToken
 * - authId: Presente cuando está autenticado
 * - userMetadata: Avatar, alias, email del usuario autenticado
 * - NO hay fallback a auth-store legacy
 * 
 * METADATA SOURCES:
 * - Alias: cachedProfile > SessionAuthority.userMetadata.alias > localStorage > 'Usuario'
 * - Avatar: cachedProfile > SessionAuthority.userMetadata.avatarUrl
 */

import { sessionAuthority } from '@/engine/session/SessionAuthority';
import { IdentityInvariantViolation } from '@/lib/errors/IdentityInvariantViolation';

export interface CreatorIdentity {
    creator_id: string;
    creator_type: 'user' | 'anonymous';
    displayAlias: string;
    avatarUrl?: string;
}

/**
 * Resuelve la identidad del creador para optimistic updates.
 * 
 * ✅ SSOT v3: SessionAuthority es la única fuente de verdad.
 * SessionToken contiene: anonymousId, authId, userMetadata
 * 
 * @throws {IdentityInvariantViolation} Si no hay identidad válida disponible
 */
export function resolveCreator(cachedProfile?: any): CreatorIdentity {
    const token = sessionAuthority.getToken();
    
    if (!token) {
        throw new IdentityInvariantViolation(
            'Cannot resolve creator: no session token. Session not initialized.',
            'resolveCreator',
            'session_token',
            null
        );
    }

    // Extract metadata from cached profile (if available)
    const profileData = cachedProfile?.data || cachedProfile;
    const cachedAlias = profileData?.alias;
    const cachedAvatar = profileData?.avatar_url;

    // CASO 1: Usuario autenticado (authId existe en el token)
    if (token.authId) {
        const userMetadata = token.userMetadata;
        
        // Smart Merge: Prefer Cached Alias > UserMetadata Alias > 'Usuario'
        let finalAlias = 'Usuario';
        if (cachedAlias && cachedAlias !== 'Usuario') {
            finalAlias = cachedAlias;
        } else if (userMetadata?.alias && userMetadata.alias !== 'Usuario') {
            finalAlias = userMetadata.alias;
        }

        return {
            creator_id: token.authId,
            creator_type: 'user',
            displayAlias: finalAlias,
            avatarUrl: cachedAvatar || userMetadata?.avatarUrl
        };
    }

    // CASO 2: Usuario anónimo
    // SessionAuthority.getAnonymousId() es SSOT
    const anonymousId = token.anonymousId;

    // 🔴 INVARIANTE: anonymousId SIEMPRE existe en el token (es requerido)
    // Solo lanzaría error si el token está corrupto
    if (!anonymousId) {
        throw new IdentityInvariantViolation(
            'Cannot resolve creator: anonymous_id is null in session token. Token may be corrupted.',
            'resolveCreator',
            'anonymous_id',
            null
        );
    }

    const localAlias = localStorage.getItem('anonymous_alias');

    // Priority: Cache > LocalStorage > Default
    const finalAlias = cachedAlias || localAlias || 'Usuario';
    const finalAvatar = cachedAvatar || undefined;

    return {
        creator_id: anonymousId,
        creator_type: 'anonymous',
        displayAlias: finalAlias,
        avatarUrl: finalAvatar
    };
}
