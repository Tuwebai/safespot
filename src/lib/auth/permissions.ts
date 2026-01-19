import { useAuthStore } from '@/store/authStore';

/**
 * Enterprise Auth Permissions Layer
 * 
 * ✅ SSOT para validación de autenticación
 * ✅ NO lee localStorage directamente (lee del auth store)
 * ✅ SSR-safe, testeable, desacoplado de storage
 * 🔴 SECURITY FIX: Validates token expiration to prevent 401 errors
 */

export interface AuthState {
    token: string | null;
    userId: string | null;
    isAnonymous: boolean;
}

/**
 * Decodifica JWT sin verificar firma (solo para extraer claims)
 * Enterprise-grade: No requiere dependencias externas
 */
function decodeJWT(token: string): { exp?: number } | null {
    try {
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;

        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );

        return JSON.parse(jsonPayload);
    } catch (error) {
        console.error('[Permissions] Failed to decode JWT:', error);
        return null;
    }
}

/**
 * 🔴 SECURITY FIX: Valida si el token JWT ha expirado
 * 
 * @param token - JWT token a validar
 * @returns true si el token está expirado o es inválido
 */
export function isTokenExpired(token: string | null): boolean {
    if (!token) return true;

    const payload = decodeJWT(token);
    if (!payload?.exp) {
        // Si no tiene exp claim, considerarlo expirado por seguridad
        return true;
    }

    // exp claim está en segundos, Date.now() en milisegundos
    const now = Math.floor(Date.now() / 1000);
    return now >= payload.exp;
}

/**
 * Obtiene el estado de autenticación desde el store centralizado
 */
export function getAuthState(): AuthState {
    const state = useAuthStore.getState();

    return {
        token: state.token,
        userId: state.user?.auth_id || null,
        isAnonymous: !state.token,
    };
}

/**
 * Verifica si el usuario está autenticado (tiene token válido y NO expirado)
 * 
 * 🔴 SECURITY FIX: Ahora valida expiración del token
 * Si el token está expirado, dispara logout silencioso para limpiar estado corrupto
 */
export function isAuthenticated(): boolean {
    const auth = getAuthState();

    // 1. Check token exists
    if (!auth.token || auth.isAnonymous) {
        return false;
    }

    // 🔴 2. SECURITY FIX: Check token expiration
    if (isTokenExpired(auth.token)) {
        console.warn('[Permissions] Token expired, triggering silent logout');
        // Silent logout to clear corrupted state
        useAuthStore.getState().logout();
        return false;
    }

    return true;
}

/**
 * Verifica si la acción requiere autenticación
 * 
 * @returns true si el usuario NO está autenticado (requiere login)
 */
export function requiresAuth(): boolean {
    return !isAuthenticated();
}
