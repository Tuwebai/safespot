/**
 * Identity Resolver v3 - SSOT Strict
 * 
 * ROLE: Única fuente de resolución de identidad para mutations.
 * RESPONSIBILITY: Leer EXCLUSIVAMENTE de SessionAuthority.
 * 
 * v3 CHANGES:
 * - Eliminada lógica de validación cruzada
 * - Eliminado parámetro cachedProfile (ya no se usa)
 * - Lectura directa de SessionAuthority.requireIdentity()
 * - No hay forma de obtener datos stale
 */

import { sessionAuthority, type ResolvedIdentity } from '@/engine/session/SessionAuthority';
import { IdentityInvariantViolation } from '@/lib/errors/IdentityInvariantViolation';

/**
 * Resuelve identidad garantizada para mutations.
 * ÚNICA función permitida para obtener identidad de creador.
 * 
 * @throws {IdentityInvariantViolation} Si identidad no está lista
 */
export function resolveMutationIdentity(): ResolvedIdentity {
    return sessionAuthority.requireIdentity();
}

/**
 * Obtiene ID garantizado para mutations anónimas.
 * 
 * @throws {IdentityInvariantViolation} Si identidad no está lista
 */
export function requireAnonymousId(): string {
    return sessionAuthority.requireAnonymousId();
}

/**
 * Obtiene ID garantizado para mutations autenticadas.
 * 
 * @throws {IdentityInvariantViolation} Si no hay sesión auth
 */
export function requireAuthId(): string {
    const authId = sessionAuthority.getAuthId();
    
    if (!authId) {
        throw new IdentityInvariantViolation(
            'Not authenticated',
            'requireAuthId',
            'auth_id',
            null
        );
    }

    return authId;
}

// Re-export para conveniencia
export type { ResolvedIdentity };
