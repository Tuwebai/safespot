import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useFavorite } from '@/hooks/useFavorite'

interface FavoriteButtonProps {
    reportId: string
    isFavorite: boolean
    onToggle?: (newState: boolean) => void
    className?: string
    size?: 'default' | 'sm' | 'lg' | 'icon'
    variant?: 'ghost' | 'outline' | 'default'
    showCount?: boolean
    count?: number
    label?: string
    disabled?: boolean
}

export function FavoriteButton({
    reportId,
    isFavorite: initialIsFavorite,
    onToggle,
    className,
    size = 'sm',
    variant = 'ghost',
    showCount = false,
    count = 0,
    label,
    disabled = false
}: FavoriteButtonProps) {
    const { isFavorite, isLoading, toggleFavorite } = useFavorite({
        reportId,
        initialState: initialIsFavorite,
        onToggle
    })

    // Determine optimistic count display (if needed)
    const displayCount = showCount
        ? count + (isFavorite && !initialIsFavorite ? 1 : (!isFavorite && initialIsFavorite ? -1 : 0))
        : 0

    return (
        <Button
            variant={variant}
            size={size}
            onClick={toggleFavorite}
            disabled={isLoading || disabled}
            className={cn(
                isFavorite ? 'text-red-400 hover:text-red-300' : '',
                className
            )}
            title={isLoading ? 'Guardando...' : (isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos')}
        >
            {isLoading ? (
                <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
            ) : (
                <Heart className={cn("h-4 w-4", label ? "mr-2" : "", isFavorite ? 'fill-current' : '')} />
            )}
            {label && <span>{label}</span>}
            {showCount && !label && <span className="ml-1">{displayCount}</span>}
        </Button>
    )
}
