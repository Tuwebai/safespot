import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, TrendingUp, ShieldCheck } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useUserZone } from '@/hooks/useUserZone'
import { Skeleton } from '@/components/ui/skeleton'
import { useLocationAuthority } from '@/hooks/useLocationAuthority'

/**
 * Sección "Tu Zona" - Personalización + Contexto (Backend Driven & SSOT)
 * Muestra la zona actual y el SafeScore REAL calculado por el servidor.
 * ✅ MOTOR 5: Consume LocationAuthorityEngine para resolución de ubicación.
 */
export function UserZoneCard() {
    const navigate = useNavigate()
    const { zones, isLoading, updateCurrentZone, isUpdating } = useUserZone()

    // ✅ MOTOR 5: Location Authority Engine
    const { requestLocation, position } = useLocationAuthority()

    // SSOT: Usamos la zona marcada como 'current'
    const currentZone = zones?.find(z => z.type === 'current')

    const handleChangeZone = async () => {
        // Solicitar ubicación vía Motor 5
        await requestLocation('manual')

        // El engine actualiza position - usamos el último obtenido
        const currentPos = position
        if (currentPos) {
            updateCurrentZone({
                lat: currentPos.lat,
                lng: currentPos.lng
            })
        }
    }

    if (isLoading) {
        return <UserZoneSkeleton />
    }

    if (!currentZone) {
        return <EmptyUserZone onSetup={handleChangeZone} isUpdating={isUpdating} />
    }

    // SSOT: Usamos el score real del backend. 
    // Si la zona es nueva o no tiene score aún, mostramos estado "Calculando..." o "N/A"
    const safeScore = currentZone.safety?.score;
    const hasScore = typeof safeScore === 'number';

    // Determinar colores según score
    let scoreColorClass = 'text-muted-foreground bg-muted';
    if (hasScore) {
        if (safeScore >= 80) scoreColorClass = 'text-green-500 bg-green-500/20';
        else if (safeScore >= 50) scoreColorClass = 'text-yellow-500 bg-yellow-500/20';
        else scoreColorClass = 'text-red-500 bg-red-500/20';
    }

    return (
        <Card className="mb-6 bg-gradient-to-br from-card/80 to-card border-border/50 hover:border-neon-green/30 transition-all duration-300 overflow-hidden">
            <CardContent className="p-4">
                {/* Header: Vertical stack for narrow containers */}
                <div className="flex flex-col gap-4 mb-4">
                    <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-neon-green/10 shrink-0">
                            <MapPin className="h-5 w-5 text-neon-green" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Tu Zona Actual</p>
                            <h3 className="text-base font-bold text-foreground leading-tight break-words">
                                {currentZone.label || "Zona Desconocida"}
                            </h3>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleChangeZone}
                        disabled={isUpdating}
                        className="w-full text-xs h-8 border-border/50 hover:bg-neon-green/10 hover:text-neon-green font-bold"
                    >
                        {isUpdating ? 'Actualizando...' : 'Actualizar Ubicación'}
                    </Button>
                </div>

                <div className="h-px bg-border/30 my-3" />

                {/* Info & Action Grid */}
                <div className="flex flex-col gap-4">
                    {/* Safe Score Indicator */}
                    <div className="flex items-center gap-3 bg-black/20 p-2 rounded-lg border border-border/30">
                        <div className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${scoreColorClass}`}>
                            <ShieldCheck className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">SafeScore™</p>
                            <p className={`text-lg font-black font-mono leading-none ${hasScore ? '' : 'text-[10px]'}`}>
                                {hasScore ? `${safeScore}/100` : 'Pendiente...'}
                            </p>
                        </div>
                    </div>

                    {/* Quick Action - Full Width button */}
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/explorar')}
                        className="w-full justify-start text-neon-green hover:bg-neon-green/10 flex items-center gap-3 h-auto py-2.5 px-3 border border-transparent hover:border-neon-green/30"
                    >
                        <TrendingUp className="h-4 w-4 shrink-0" />
                        <div className="text-left overflow-hidden">
                            <span className="block text-[10px] font-medium text-muted-foreground truncate uppercase tracking-tighter">Históricos</span>
                            <span className="block text-xs font-bold whitespace-nowrap">Mapa de Calor</span>
                        </div>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function EmptyUserZone({ onSetup, isUpdating }: { onSetup: () => void, isUpdating: boolean }) {
    return (
        <Card className="mb-6 border-dashed border-2 border-border/30 bg-black/10">
            <CardContent className="p-4 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-3 rounded-full bg-muted/50 shrink-0">
                        <MapPin className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-foreground">Configurar Zona</h3>
                        <p className="text-[10px] text-muted-foreground leading-tight">
                            Personaliza alertas locales.
                        </p>
                    </div>
                </div>
                <Button
                    onClick={onSetup}
                    disabled={isUpdating}
                    variant="default"
                    className="w-full h-9 bg-neon-green text-black hover:bg-neon-green/90 font-bold text-xs"
                >
                    {isUpdating ? 'Activando...' : 'Activar mi ubicación'}
                </Button>
            </CardContent>
        </Card>
    )
}

function UserZoneSkeleton() {
    return (
        <Card className="mb-6 border-border/30">
            <CardContent className="p-4 space-y-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                    <div className="space-y-2 flex-1">
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-5 w-full" />
                    </div>
                </div>
                <Skeleton className="h-8 w-full rounded-md" />
                <div className="h-px bg-border/20" />
                <Skeleton className="h-10 w-full rounded-md" />
                <Skeleton className="h-10 w-full rounded-md" />
            </CardContent>
        </Card>
    )
}
