import { useState, useCallback, useRef } from 'react'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'

interface UseFavoriteOptions {
    onToggle?: (reportId: string, isFavorite: boolean) => void
    onError?: (reportId: string, error: Error) => void
}

/**
 * useFavorite Hook
 * 
 * Provides race-condition-safe favorite toggling with:
 * - Per-report mutex (prevents spam clicks)
 * - Optimistic updates with revert on error
 * - Consistent behavior across all views
 * 
 * Usage:
 * const { toggleFavorite, isToggling, getState } = useFavorite({
 *   onToggle: (id, isFav) => updateLocalState(id, isFav)
 * })
 */
export function useFavorite(options: UseFavoriteOptions = {}) {
    const toast = useToast()
    const { onToggle, onError } = options

    // Track toggling state per report ID
    const [togglingSet, setTogglingSet] = useState<Set<string>>(new Set())

    // Mutex map to prevent concurrent requests per report
    const mutexRef = useRef<Map<string, boolean>>(new Map())

    /**
     * Check if a specific report is currently being toggled
     */
    const isToggling = useCallback((reportId: string): boolean => {
        return togglingSet.has(reportId)
    }, [togglingSet])

    /**
     * Toggle favorite status for a report
     * Returns the new favorite state or null if request was blocked
     */
    const toggleFavorite = useCallback(async (
        reportId: string,
        currentIsFavorite: boolean
    ): Promise<boolean | null> => {
        // Mutex check: prevent concurrent requests for same report
        if (mutexRef.current.get(reportId)) {
            return null
        }

        // Acquire mutex
        mutexRef.current.set(reportId, true)
        setTogglingSet(prev => new Set(prev).add(reportId))

        const previousState = currentIsFavorite
        const optimisticState = !currentIsFavorite

        // Optimistic update callback
        onToggle?.(reportId, optimisticState)

        try {
            const result = await reportsApi.toggleFavorite(reportId)

            // Validate server response
            if (!result || typeof result.is_favorite !== 'boolean') {
                throw new Error('Respuesta inválida del servidor')
            }

            const serverState = result.is_favorite

            // If server state differs from optimistic, update
            if (serverState !== optimisticState) {
                onToggle?.(reportId, serverState)
            }

            return serverState

        } catch (error) {
            // Revert optimistic update
            onToggle?.(reportId, previousState)

            const errorMessage = error instanceof Error ? error.message : 'Error al actualizar favorito'
            toast.error(errorMessage)

            onError?.(reportId, error instanceof Error ? error : new Error(errorMessage))

            return null

        } finally {
            // Release mutex
            mutexRef.current.delete(reportId)
            setTogglingSet(prev => {
                const next = new Set(prev)
                next.delete(reportId)
                return next
            })
        }
    }, [onToggle, onError, toast])

    /**
     * Get the current toggling set (for components that need the full set)
     */
    const getTogglingSet = useCallback((): Set<string> => {
        return togglingSet
    }, [togglingSet])

    return {
        toggleFavorite,
        isToggling,
        getTogglingSet
    }
}

/**
 * FavoriteButton Component Props
 * Use this interface when creating a FavoriteButton component
 */
export interface FavoriteButtonProps {
    reportId: string
    isFavorite: boolean
    isToggling: boolean
    onToggle: (e: React.MouseEvent) => void
}
