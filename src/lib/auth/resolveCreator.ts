/**
 * resolveCreator
 * 
 * ROLE: Identity Resolution Engine for Mutations
 * RESPONSIBILITY: Resolve creator identity for optimistic updates
 * 
 * PRIORITY HIERARCHY:
 * 1. Supabase Auth (auth.user.auth_id) - Real users
 * 2. SessionAuthority (anonymous_id) - Anonymous users (SSOT)
 * 3. Fallback ('unknown') - Emergency only
 * 
 * METADATA SOURCES:
 * - Alias: cachedProfile > localStorage > 'Usuario'
 * - Avatar: cachedProfile > auth.user.avatar_url
 */

import { sessionAuthority } from '@/engine/session/SessionAuthority';
import { useAuthStore } from '@/store/authStore';

export interface CreatorIdentity {
    creator_id: string;
    creator_type: 'user' | 'anonymous';
    displayAlias: string;
    avatarUrl?: string;
}

export function resolveCreator(cachedProfile?: any): CreatorIdentity {
    const auth = useAuthStore.getState();

    // Extract metadata from cached profile (if available)
    const profileData = cachedProfile?.data || cachedProfile;
    const cachedAlias = profileData?.alias;
    const cachedAvatar = profileData?.avatar_url;

    // CASO 1: Usuario autenticado (PRIORIDAD ABSOLUTA DE ID)
    if (auth.token && auth.user?.auth_id) {
        // Smart Merge: Prefer Cached Alias > Auth Store Alias > 'Usuario'
        const authAlias = auth.user.alias;

        let finalAlias = 'Usuario';
        if (cachedAlias && cachedAlias !== 'Usuario') {
            finalAlias = cachedAlias;
        } else if (authAlias && authAlias !== 'Usuario') {
            finalAlias = authAlias;
        }

        return {
            creator_id: auth.user.auth_id,
            creator_type: 'user',
            displayAlias: finalAlias,
            avatarUrl: cachedAvatar || auth.user.avatar_url
        };
    }

    // CASO 2: Usuario anónimo
    // ✅ ENTERPRISE FIX: SessionAuthority es SSOT para anonymous_id
    // cachedProfile puede tener anonymous_id VIEJO si hubo cambio de sesión
    // SIEMPRE usar SessionAuthority.getAnonymousId() como fuente de verdad
    const anonymousId = sessionAuthority.getAnonymousId();

    const finalId = anonymousId || 'unknown';
    const localAlias = localStorage.getItem('anonymous_alias');

    // Priority: Cache > LocalStorage > Default
    const finalAlias = cachedAlias || localAlias || 'Usuario';
    const finalAvatar = cachedAvatar || undefined;

    return {
        creator_id: finalId,
        creator_type: 'anonymous',
        displayAlias: finalAlias,
        avatarUrl: finalAvatar
    };
}
