import { Button } from '@/components/ui/button'
import { Heart, Edit, Trash2, Flag, Save, X } from 'lucide-react'
import { getAnonymousIdSafe } from '@/lib/identity'
import type { Report } from '@/lib/api'

// ============================================
// TYPES
// ============================================

interface ReportActionsProps {
    report: Report
    isFavorite: boolean
    savingFavorite: boolean
    isEditing: boolean
    updating: boolean
    onFavorite: () => void
    onStartEdit: () => void
    onSaveEdit: () => void
    onCancelEdit: () => void
    onFlag: () => void
    onDelete: () => void
}

// ============================================
// COMPONENT
// ============================================

export function ReportActions({
    report,
    isFavorite,
    savingFavorite,
    isEditing,
    updating,
    onFavorite,
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
            <Button
                variant="ghost"
                size="sm"
                onClick={onFavorite}
                disabled={savingFavorite}
                className={isFavorite ? 'text-red-400 hover:text-red-300' : ''}
                title={savingFavorite ? 'Guardando...' : (isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos')}
            >
                {savingFavorite ? (
                    <>
                        <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                        Guardando...
                    </>
                ) : (
                    <>
                        <Heart className={`h-4 w-4 mr-2 ${isFavorite ? 'fill-current' : ''}`} />
                        Guardar
                    </>
                )}
            </Button>

            {/* Owner Actions */}
            {isOwner && (
                <>
                    {!isEditing ? (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onStartEdit}
                                className="hover:text-neon-green"
                                title="Editar reporte"
                            >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onDelete}
                                className="hover:text-red-400"
                                title="Eliminar reporte"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Eliminar
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onSaveEdit}
                                disabled={updating}
                                className="hover:text-neon-green"
                                title="Guardar cambios"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                {updating ? 'Guardando...' : 'Guardar'}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onCancelEdit}
                                disabled={updating}
                                className="hover:text-red-400"
                                title="Cancelar edición"
                            >
                                <X className="h-4 w-4 mr-2" />
                                Cancelar
                            </Button>
                        </>
                    )}
                </>
            )}

            {/* Non-owner: Flag button */}
            {!isOwner && (
                isFlagged ? (
                    <span className="text-sm text-foreground/60" title="Ya has denunciado este reporte">
                        Denunciado
                    </span>
                ) : (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onFlag}
                        className="hover:text-yellow-400"
                        title="Reportar contenido inapropiado"
                    >
                        <Flag className="h-4 w-4 mr-2" />
                        Reportar
                    </Button>
                )
            )}
        </div>
    )
}
