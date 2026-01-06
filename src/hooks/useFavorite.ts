import { useState, useCallback } from 'react'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { triggerBadgeCheck } from './useBadgeNotifications'

interface UseFavoriteProps {
    reportId: string
    initialState?: boolean
    onToggle?: (newState: boolean) => void
}

interface UseFavoriteReturn {
    isFavorite: boolean
    toggleFavorite: (e?: React.MouseEvent) => Promise<void>
}

export function useFavorite({ reportId, initialState = false, onToggle }: UseFavoriteProps): UseFavoriteReturn {
    const [isFavorite, setIsFavorite] = useState(initialState)
    const toast = useToast()

    const toggleFavorite = useCallback(async (e?: React.MouseEvent) => {
        e?.preventDefault()
        e?.stopPropagation()

        // Optimistic update - Radical: No waiting, just toggle
        const previousState = isFavorite
        const newState = !previousState

        setIsFavorite(newState)
        onToggle?.(newState)

        try {
            const result = await reportsApi.toggleFavorite(reportId)

            // Validate contract
            if (!result || typeof result !== 'object' || typeof result.is_favorite !== 'boolean') {
                throw new Error('Respuesta inválida del servidor')
            }

            // Sync with server state (should match optimistic state usually)
            if (result.is_favorite !== newState) {
                setIsFavorite(result.is_favorite)
                onToggle?.(result.is_favorite)
            }

            // Trigger badge check after success
            triggerBadgeCheck()
        } catch (error) {
            // Revert on error
            setIsFavorite(previousState)
            onToggle?.(previousState)
            handleErrorWithMessage(error, 'Error al guardar en favoritos', toast.error, 'useFavorite.toggleFavorite')
        }
    }, [reportId, isFavorite, onToggle, toast])

    return {
        isFavorite,
        toggleFavorite
    }
}
