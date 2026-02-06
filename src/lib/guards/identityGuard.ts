/**
 * Identity Guard (Enterprise Lifecycle Contract)
 * 
 * ROLE: Formaliza cuándo el sistema está listo para WRITE operations.
 * RESPONSIBILITY: Validar que SessionAuthority.state === READY antes de mutations.
 * 
 * CONTRATO:
 * - READY: Identidad estable, mutations permitidas
 * - BOOTSTRAPPING/UNINITIALIZED: Identidad transitoria, mutations bloqueadas
 * - DEGRADED/FAILED/EXPIRED: Bloqueadas (estricto, puede relajarse después)
 * 
 * ARQUITECTURA:
 * - Guard es PURO (solo validación, sin side-effects)
 * - UI decide si mostrar toast
 * - Testeable y reutilizable
 */

import { useState, useEffect } from 'react';
import { sessionAuthority, SessionState } from '@/engine/session/SessionAuthority';

/**
 * Error custom para identity no lista.
 * Permite a consumers distinguir este error de otros.
 */
export class IdentityNotReadyError extends Error {
    public readonly state: SessionState;

    constructor(state: SessionState) {
        super('Identity not ready for mutations');
        this.name = 'IdentityNotReadyError';
        this.state = state;
    }
}

/**
 * Guard PURO para mutations que requieren identity estable.
 * 
 * CONTRATO:
 * - Solo permite mutations cuando SessionAuthority.state === READY
 * - Lanza IdentityNotReadyError si state !== READY
 * - NO tiene side-effects (no toast, no logs de usuario)
 * 
 * USO:
 * ```typescript
 * onMutate: async (variables) => {
 *     try {
 *         guardIdentityReady();
 *     } catch (e) {
 *         if (e instanceof IdentityNotReadyError) {
 *             toast.warning('Identidad no lista. Intenta nuevamente.');
 *         }
 *         throw e;
 *     }
 *     
 *     // ... optimistic update ...
 * }
 * ```
 * 
 * @throws {IdentityNotReadyError} Si SessionAuthority.state !== READY
 */
export function guardIdentityReady(): void {
    const state = sessionAuthority.getState();

    // ✅ ENTERPRISE STRICT: Solo READY permite mutations
    // DEGRADED/FAILED bloqueados inicialmente (puede relajarse después si es seguro)
    if (state !== SessionState.READY) {
        console.warn('[IdentityGuard] Mutation blocked. State:', state);
        throw new IdentityNotReadyError(state);
    }
}

/**
 * Hook reactivo para UI guards.
 * 
 * Retorna `true` solo cuando SessionAuthority.state === READY.
 * 
 * USO:
 * ```typescript
 * const isIdentityReady = useIsIdentityReady();
 * 
 * <Button
 *     disabled={!isIdentityReady || isSubmitting}
 *     onClick={handleSubmit}
 * >
 *     {!isIdentityReady ? 'Cargando identidad...' : 'Enviar'}
 * </Button>
 * ```
 */
export function useIsIdentityReady(): boolean {
    const [isReady, setIsReady] = useState(() => {
        return sessionAuthority.getState() === SessionState.READY;
    });

    useEffect(() => {
        // Initial sync
        const currentState = sessionAuthority.getState();
        if ((currentState === SessionState.READY) !== isReady) {
            setIsReady(currentState === SessionState.READY);
        }

        // Subscribe to state changes
        const unsubscribe = sessionAuthority.subscribe((state) => {
            setIsReady(state === SessionState.READY);
        });

        return unsubscribe;
    }, [isReady]);

    return isReady;
}
