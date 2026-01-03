import { Heart } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToggleFavoriteMutation } from '@/hooks/queries/useReportsQuery'
import { useToast } from '@/components/ui/toast'

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
    isFavorite,
    onToggle,
    className,
    size = 'sm',
    variant = 'ghost',
    showCount = false,
    count = 0,
    label,
    disabled = false
}: FavoriteButtonProps) {
    const toast = useToast()
    const { mutate: toggleFavorite } = useToggleFavoriteMutation()

    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()

        if (disabled) return

        // Optimistic update handled by mutation
        toggleFavorite(reportId, {
            onError: (error) => {
                const message = error instanceof Error ? error.message : 'Error al actualizar favorito'
                toast.error(message)
            },
            onSuccess: () => {
                onToggle?.(!isFavorite)
            }
        })
    }

    return (
        <Button
            variant={variant}
            size={size}
            onClick={handleClick}
            disabled={disabled}
            className={cn(
                isFavorite ? 'text-red-400 hover:text-red-300' : '',
                className
            )}
            title={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
        >
            <motion.div
                whileTap={{ scale: 0.85 }}
                whileHover={{ scale: 1.1 }}
                animate={{
                    scale: isFavorite ? [1, 1.2, 1] : 1
                }}
                transition={{
                    duration: 0.3,
                    ease: "easeOut"
                }}
            >
                <Heart className={cn("h-4 w-4", label ? "mr-2" : "", isFavorite ? 'fill-current' : '')} />
            </motion.div>
            {label && <span>{label}</span>}
            {showCount && !label && <span className="ml-1">{count}</span>}
        </Button>
    )
}
