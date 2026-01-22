import { useAnonymousId } from './useAnonymousId';

/**
 * Hook SSOT para determinar ownership.
 * Compara IDs de forma estricta.
 * @param authorId ID del autor de la entidad (Report | Comment)
 * @returns boolean true si el usuario actual es el dueño
 */
export function useIsOwner(authorId: string | undefined | null): boolean {
    const currentId = useAnonymousId();

    if (!currentId || !authorId) return false;

    // Normalización defensiva (si vienen con prefijos, cleanId ya debería manejarse en identity, pero blindamos)
    return currentId === authorId;
}
