import { requiresAuth } from '@/lib/auth/permissions';
import { useAuthGuardContext } from '@/contexts/AuthGuardContext';

/**
 * Auth Guard Hook
 * 
 * ✅ ENTERPRISE FIX: NO maneja su propio modal
 * ✅ Stateless - solo checkAuth()
 * ✅ Modal global controlado por Provider
 * 
 * @example
 * const { checkAuth } = useAuthGuard();
 * 
 * if (!checkAuth()) {
 *   return; // Modal se abre automáticamente
 * }
 * // Continuar con la acción...
 */
export function useAuthGuard() {
    const { openModal } = useAuthGuardContext();

    /**
     * Verifica si el usuario puede proceder con la acción
     * 
     * @returns true si puede proceder, false si debe autenticarse
     */
    const checkAuth = (): boolean => {
        if (requiresAuth()) {
            openModal();
            return false; // Bloquear acción
        }
        return true; // Permitir acción
    };

    return { checkAuth };
}
