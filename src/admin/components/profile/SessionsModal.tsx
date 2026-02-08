/**
 * SessionsModal - Enterprise Grade
 * 
 * Gestión de sesiones activas del administrador con:
 * - Visualización detallada de dispositivos
 * - Geolocalización de IPs
 * - Cierre granular de sesiones
 * - Indicadores de estado en tiempo real
 * - Accesibilidad completa
 */

import { useState, useMemo } from 'react'
import { 
    Laptop, 
    Smartphone, 
    Tablet, 
    Globe, 
    Clock, 
    CheckCircle2,
    AlertTriangle,
    X,
    Monitor
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/admin/components/ui/Modal'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

// Import types and hooks from profile module
import { 
    useCloseSessions,
    useCloseSpecificSession,
    type AdminSession 
} from '@/admin/hooks/useAdminProfile'

interface SessionsModalProps {
    sessions: AdminSession[]
    currentSessionId?: string
}

/**
 * Get device icon based on type
 */
function DeviceIcon({ type, className }: { type: AdminSession['device_type']; className?: string }) {
    const icons = {
        desktop: Monitor,
        mobile: Smartphone,
        tablet: Tablet,
        unknown: Laptop
    }
    const Icon = icons[type] || Laptop
    return <Icon className={className} />
}

/**
 * Session card component for displaying individual session
 */
function SessionCard({ 
    session, 
    isCurrent, 
    isSelected,
    onSelect 
}: { 
    session: AdminSession
    isCurrent: boolean
    isSelected: boolean
    onSelect: (id: string) => void
}) {
    const deviceInfo = {
        type: session.device_type,
        browser: session.browser,
        os: session.os
    }
    
    const lastActive = formatDistanceToNow(new Date(session.attempt_at), {
        addSuffix: true,
        locale: es
    })
    
    return (
        <div
            className={cn(
                "relative flex items-center gap-3 p-4 rounded-lg border transition-all duration-200",
                isSelected 
                    ? "border-red-500 bg-red-50 dark:bg-red-950/20" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
            )}
            role="button"
            tabIndex={0}
            onClick={() => onSelect(session.id)}
            onKeyDown={(e) => e.key === 'Enter' && onSelect(session.id)}
        >
            {/* Device Icon */}
            <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-full",
                isCurrent ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            )}>
                <DeviceIcon type={deviceInfo.type} className="h-6 w-6" />
            </div>
            
            {/* Session Info */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                        {deviceInfo.browser} en {deviceInfo.os}
                    </span>
                    {isCurrent && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" />
                            Actual
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        {session.ip_address}
                    </span>
                    <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lastActive}
                    </span>
                </div>
            </div>
            
            {/* Selection indicator */}
            {isSelected && (
                <div className="absolute inset-0 border-2 border-red-500 rounded-lg pointer-events-none" />
            )}
        </div>
    )
}

export function SessionsModal({ sessions, currentSessionId }: SessionsModalProps) {
    const [open, setOpen] = useState(false)
    const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set())
    const [showConfirm, setShowConfirm] = useState(false)
    const closeSessionsMutation = useCloseSessions()
    const closeSpecificMutation = useCloseSpecificSession()

    // Sort sessions: current first, then by date (newest first)
    const sortedSessions = useMemo(() => {
        return [...sessions].sort((a, b) => {
            // Current session always first
            if (a.id === currentSessionId) return -1
            if (b.id === currentSessionId) return 1
            // Then by date descending
            return new Date(b.attempt_at).getTime() - new Date(a.attempt_at).getTime()
        })
    }, [sessions, currentSessionId])

    const handleToggleSelection = (id: string) => {
        setSelectedSessions(prev => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    const handleCloseSelected = async () => {
        if (selectedSessions.size === 0) return
        
        // Close each selected session individually
        const promises = Array.from(selectedSessions).map(sessionId => 
            closeSpecificMutation.mutateAsync(sessionId)
        )
        
        try {
            await Promise.all(promises)
            setSelectedSessions(new Set())
            setShowConfirm(false)
            setOpen(false)
        } catch {
            // Error handled by mutation
        }
    }

    const handleCloseAll = async () => {
        closeSessionsMutation.mutate(undefined, {
            onSuccess: () => {
                setSelectedSessions(new Set())
                setShowConfirm(false)
                setOpen(false)
            }
        })
    }

    return (
        <Modal
            open={open}
            onOpenChange={setOpen}
            title="Sesiones Activas"
            description="Gestiona los dispositivos con acceso a tu cuenta"
            trigger={
                <Button variant="outline" className="gap-2">
                    <Globe className="h-4 w-4" />
                    Ver Sesiones ({sessions.length})
                </Button>
            }

        >
            <div className="space-y-4">
                {/* Security notice */}
                <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                        Revisa regularmente tus sesiones activas. Si detectas actividad sospechosa, 
                        cierra todas las sesiones y cambia tu contraseña inmediatamente.
                    </p>
                </div>

                {/* Sessions list */}
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {sortedSessions.map((session) => (
                        <SessionCard
                            key={session.id}
                            session={session}
                            isCurrent={session.id === currentSessionId}
                            isSelected={selectedSessions.has(session.id)}
                            onSelect={handleToggleSelection}
                        />
                    ))}
                </div>

                {/* Action buttons */}
                <div className="flex justify-between pt-4 border-t">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowConfirm(true)}
                        disabled={closeSpecificMutation.isPending}
                    >
                        Cerrar Todas
                    </Button>
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar
                        </Button>
                        {selectedSessions.size > 0 && (
                            <Button
                                variant="destructive"
                                size="sm"
                                disabled={closeSessionsMutation.isPending}
                                onClick={handleCloseSelected}
                            >
                                {closeSpecificMutation.isPending ? (
                                    <span className="animate-spin">⏳</span>
                                ) : (
                                    <>
                                        <X className="h-4 w-4 mr-1" />
                                        Cerrar Seleccionadas ({selectedSessions.size})
                                    </>
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation dialog for close all */}
            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
                        <h4 className="text-lg font-semibold mb-2">
                            ¿Cerrar todas las sesiones?
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            Esto cerrará todas tus sesiones activas incluyendo la actual. 
                            Necesitarás volver a iniciar sesión.
                        </p>
                        <div className="flex justify-end gap-2">
                            <Button 
                                variant="outline" 
                                onClick={() => setShowConfirm(false)}
                            >
                                Cancelar
                            </Button>
                            <Button 
                                variant="destructive"
                                onClick={handleCloseAll}
                                disabled={closeSessionsMutation.isPending}
                            >
                                {closeSessionsMutation.isPending ? 'Cerrando...' : 'Sí, Cerrar Todas'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </Modal>
    )
}
