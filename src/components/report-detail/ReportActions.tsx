import { memo } from 'react'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Flag, Save, X } from 'lucide-react'
import { getAnonymousIdSafe } from '@/lib/identity'
import { FavoriteButton } from '@/components/FavoriteButton'
import { cn } from '@/lib/utils'
import type { Report } from '@/lib/api'

// ============================================
// TYPES
// ============================================

interface ReportActionsProps {
    report: Report
    isFavorite: boolean
    isEditing: boolean
    updating: boolean // Specific loading state for save action
    disabled?: boolean // Global disabled state (e.g. while deleting)
    onFavoriteToggle?: (newState: boolean) => void
    onStartEdit: () => void
    onSaveEdit: () => void
    onCancelEdit: () => void
    onFlag: () => void
    onDelete: () => void
}

// ============================================
// COMPONENT
// ============================================

export const ReportActions = memo(function ReportActions({
    report,
    isFavorite,
    isEditing,
    updating,
    disabled = false,
    onFavoriteToggle,
    onStartEdit,
    onSaveEdit,
    onCancelEdit,
    onFlag,
    onDelete,
}: ReportActionsProps) {
    const currentAnonymousId = getAnonymousIdSafe()
    const isOwner = report.anonymous_id === currentAnonymousId
    const isFlagged = report.is_flagged ?? false

    return (
        <div className="flex items-center space-x-2">
            {/* Favorite Button - Always visible */}
            <FavoriteButton
                reportId={report.id}
                isFavorite={isFavorite}
                onToggle={onFavoriteToggle}
                label="Guardar"
                disabled={disabled}
            />

            {/* Owner Actions */}
            {isOwner && (
                <>
                    {/* Edit Actions */}
                    {isEditing ? (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onCancelEdit}
                                disabled={updating || disabled}
                                className="border-dark-border text-foreground"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancelar
                            </Button>
                            <Button
                                size="sm"
                                onClick={onSaveEdit}
                                disabled={updating || disabled}
                                className="bg-neon-green text-dark-bg hover:bg-neon-green/90"
                            >
                                {updating ? (
                                    <div className="animate-spin h-4 w-4 border-2 border-dark-bg border-t-transparent rounded-full mr-2" />
                                ) : (
                                    <Save className="h-4 w-4 mr-2" />
                                )}
                                Guardar
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onStartEdit}
                                disabled={disabled}
                            >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDelete}
                                disabled={disabled}
                                className="text-red-400 hover:text-red-500 hover:bg-red-500/10"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </Button>
                        </>
                    )}
                </>
            )}

            {/* Viewer Actions */}
            {!isOwner && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onFlag}
                    disabled={isFlagged || disabled}
                    className={isFlagged ? 'text-yellow-500 cursor-not-allowed' : 'text-foreground/70 hover:text-foreground'}
                    title={isFlagged ? 'Ya has reportado este contenido' : 'Reportar contenido inapropiado'}
                >
                    <Flag className={cn("h-4 w-4 mr-2", isFlagged ? "fill-current" : "")} />
                    {isFlagged ? 'Reportado' : 'Reportar'}
                </Button>
            )}
        </div>
    )
})
