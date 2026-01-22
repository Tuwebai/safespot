import { useAuthStore } from '@/store/authStore';
import { getAnonymousIdSafe } from '@/lib/identity';

/**
 * 🔴 ENTERPRISE FIX: Resolve Creator Identity (SSOT)
 * 
 * Este helper centraliza la lógica de determinación de creator para optimistic updates.
 * 
 * REGLA DE ORO (SSOT):
 * - Si autenticado → creator = user.auth_id (identity real)
 * - Si anónimo → creator = anonymous_id (identity dispositiva)
 * 
 * Esto asegura que el ID local coincida con lo que el servidor guardará.
 */

export interface CreatorInfo {
    creator_id: string; // Nunca null para creadores activos
    creator_type: 'user' | 'anonymous';
    displayAlias: string;
    avatarUrl?: string; // Optional pre-resolved avatar
}

/**
 * Resuelve la identidad del creator según el estado de autenticación
 * 
 * @returns {CreatorInfo} Información completa del creator con alias display
 */
export function resolveCreator(cachedProfile?: any): CreatorInfo {
    const auth = useAuthStore.getState();

    // ✅ ENTERPRISE FIX: Smart Alias Resolution
    // Always extract cached profile first (it's often fresher than auth store snapshot)
    const profileData = cachedProfile?.data || cachedProfile;
    const cachedAlias = profileData?.alias;
    const cachedAvatar = profileData?.avatar_url;

    // CASO 1: Usuario autenticado (PRIORIDAD ABSOLUTA DE ID)
    if (auth.token && auth.user?.auth_id) {
        // Smart Merge: Prefer Cached Alias > Auth Store Alias > 'Usuario'
        // This handles cases where auth store has stale login snapshot but profile query is fresh
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
            avatarUrl: cachedAvatar || auth.user.avatar_url // Prefer fresh avatar too
        };
    }

    // CASO 2: Usuario anónimo (Fallback a Device ID)
    const anonymousId = getAnonymousIdSafe();
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

