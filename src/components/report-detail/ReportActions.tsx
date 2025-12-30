import { memo, useState, useCallback, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Edit, Trash2, Flag, Save, X, FileText, MoreVertical, Heart } from 'lucide-react'
import { getAnonymousIdSafe } from '@/lib/identity'
import { cn } from '@/lib/utils'
import type { Report } from '@/lib/api'
import { ShareButton } from '@/components/ShareButton'

// ============================================
// TYPES
// ============================================

interface ReportActionsProps {
    report: Report
    isFavorite: boolean
    isEditing: boolean
    updating: boolean
    disabled?: boolean
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
    const [showMenu, setShowMenu] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const currentAnonymousId = getAnonymousIdSafe()
    const isOwner = report.anonymous_id === currentAnonymousId
    const isFlagged = report.is_flagged ?? false

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setShowMenu(false)
            }
        }
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [showMenu])

    const handleDownload = useCallback(() => {
        // Use the same logic as in lib/api.ts to avoid duplication
        const rawUrl = import.meta.env.VITE_API_URL || 'https://safespot-6e51.onrender.com';
        const baseUrl = rawUrl.replace(/\/$/, '').endsWith('/api')
            ? rawUrl.replace(/\/$/, '').slice(0, -4) // Remove /api to avoid duplication below
            : rawUrl.replace(/\/$/, '');

        window.open(`${baseUrl}/api/reports/${report.id}/pdf`, '_blank');
        setShowMenu(false)
    }, [report.id])

    return (
        <div className="flex items-center space-x-2 relative" ref={menuRef}>
            {/* 1. Primary Action: Share (Desktop only in header) */}
            <div className="hidden md:block">
                {!isEditing && (
                    <ShareButton
                        category={report.category}
                        zone={report.address || report.zone || 'Ubicación desconocida'}
                        reportId={report.id}
                        variant="default"
                    />
                )}
            </div>

            {/* 2. Owner Editing Actions (Visible when editing) */}
            {isEditing && (
                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onCancelEdit}
                        disabled={updating || disabled}
                        className="text-foreground/70"
                    >
                        <X className="h-4 w-4 mr-2" />
                        <span className="hidden sm:inline">Cancelar</span>
                    </Button>
                    <Button
                        size="sm"
                        onClick={onSaveEdit}
                        disabled={updating || disabled}
                        className="bg-neon-green text-dark-bg hover:bg-neon-green/90 font-bold"
                    >
                        {updating ? (
                            <div className="animate-spin h-4 w-4 border-2 border-dark-bg border-t-transparent rounded-full mr-2" />
                        ) : (
                            <Save className="h-4 w-4 mr-2" />
                        )}
                        Guardar
                    </Button>
                </div>
            )}

            {/* 3. More Options Menu (⋯) */}
            {!isEditing && (
                <div className="relative">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setShowMenu(!showMenu)}
                        disabled={disabled}
                        className={cn(
                            "rounded-full hover:bg-dark-border/50 transition-colors",
                            showMenu && "bg-dark-border/50 text-neon-green"
                        )}
                        title="Más opciones"
                    >
                        <MoreVertical className="h-5 w-5" />
                    </Button>

                    {showMenu && (
                        <div className="absolute right-0 top-full mt-2 z-50 bg-dark-card border border-dark-border rounded-xl shadow-2xl overflow-hidden min-w-[220px] animate-in fade-in slide-in-from-top-2 duration-200">

                            {/* Favorite/Save Toggle */}
                            <button
                                onClick={() => {
                                    onFavoriteToggle?.(!isFavorite)
                                    setShowMenu(false)
                                }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-border/50 transition-colors text-left text-sm"
                            >
                                <Heart className={cn("h-4 w-4", isFavorite ? "fill-red-500 text-red-500" : "text-foreground/70")} />
                                <span>{isFavorite ? 'Quitar de favoritos' : 'Guardar reporte'}</span>
                            </button>

                            {/* Download PDF */}
                            <button
                                onClick={handleDownload}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-border/50 transition-colors text-left text-sm"
                            >
                                <FileText className="h-4 w-4 text-foreground/70" />
                                <span>Descargar PDF Oficial</span>
                            </button>

                            <div className="border-t border-dark-border my-1" />

                            {/* Owner specific actions in the menu */}
                            {isOwner ? (
                                <>
                                    <button
                                        onClick={() => {
                                            onStartEdit()
                                            setShowMenu(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-dark-border/50 transition-colors text-left text-sm"
                                    >
                                        <Edit className="h-4 w-4 text-foreground/70" />
                                        <span>Editar reporte</span>
                                    </button>
                                    <button
                                        onClick={() => {
                                            onDelete()
                                            setShowMenu(false)
                                        }}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-500/10 transition-colors text-left text-sm text-red-400"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        <span>Eliminar reporte</span>
                                    </button>
                                </>
                            ) : (
                                /* Viewer Flagging Action */
                                <button
                                    onClick={() => {
                                        if (!isFlagged) onFlag()
                                        setShowMenu(false)
                                    }}
                                    disabled={isFlagged}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 transition-colors text-left text-sm",
                                        isFlagged ? "text-yellow-500 cursor-not-allowed" : "hover:bg-dark-border/50 text-foreground/70"
                                    )}
                                >
                                    <Flag className={cn("h-4 w-4", isFlagged && "fill-current")} />
                                    <span>{isFlagged ? 'Ya reportado' : 'Reportar contenido'}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
})
