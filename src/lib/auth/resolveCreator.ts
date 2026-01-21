import { useAuthStore } from '@/store/authStore';

/**
 * 🔴 ENTERPRISE FIX: Resolve Creator Identity (SSOT)
 * 
 * Este helper centraliza la lógica de determinación de creator para optimistic updates.
 * 
 * REGLA: 
 * - Si autenticado → creator = user.auth_id (identity real)
 * - Si anónimo → creator = anonymous_id (identity anónima)
 * 
 * ALIAS:
 * - El alias es SEPARADO del creator (solo visual)
 * - Siempre se muestra (UX histórica)
 */

export interface CreatorInfo {
    creator_id: string | null;
    creator_type: 'user' | 'anonymous';
    displayAlias: string;
}

/**
 * Resuelve la identidad del creator según el estado de autenticación
 * 
 * @returns {CreatorInfo} Información completa del creator con alias display
 */
export function resolveCreator(): CreatorInfo {
    const auth = useAuthStore.getState();

    // CASO 1: Usuario autenticado
    if (auth.token && auth.user?.auth_id) {
        // 🔵 UX FIX: Always use Device ID (anonymous_id) for Creator ID
        // The Renderer (CommentsSection) uses Validated Device ID to check isOwner.
        // If we return auth_id here, isOwner becomes false until server refresh, causing Grey -> Green flicker.
        const deviceId = localStorage.getItem('safespot_anonymous_id'); // L1_KEY manual read

        return {
            creator_id: deviceId || auth.user.auth_id, // Fallback to auth_id if LS empty (rare)
            creator_type: 'user',
            displayAlias: auth.user.alias || 'Usuario'
        };
    }

    // CASO 2: Usuario anónimo (lectura / legacy)
    // Leer anonymous_id desde localStorage como fallback
    const anonymousId = localStorage.getItem('anonymous_id');
    const anonymousAlias = localStorage.getItem('anonymous_alias');

    return {
        creator_id: anonymousId,
        creator_type: 'anonymous',
        displayAlias: anonymousAlias || 'Usuario'
    };
}
