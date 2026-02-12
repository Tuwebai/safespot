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
        <Card className="mb-6 bg-gradient-to-r from-card/50 to-card border-border/50 hover:border-neon-green/30 transition-all duration-300">
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neon-green/10">
                            <MapPin className="h-5 w-5 text-neon-green" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Tu Zona Actual</p>
                            <h3 className="text-lg font-semibold text-foreground">
                                {currentZone.label || "Zona Desconocida"}
                            </h3>
                        </div>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleChangeZone}
                        disabled={isUpdating}
                        className="hover:bg-neon-green/10 hover:text-neon-green hover:border-neon-green/50"
                    >
                        {isUpdating ? 'Actualizando...' : 'Actualizar Ubicación'}
                    </Button>
                </div>

                <div className="h-px bg-border/50 my-4" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    {/* Safe Score Indicator */}
                    <div className="flex items-center gap-3">
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${scoreColorClass}`}>
                            <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">SafeScore™</p>
                            <p className={`text-xl font-bold font-mono ${hasScore ? '' : 'text-sm'}`}>
                                {hasScore ? `${safeScore}/100` : 'Pendiente...'}
                            </p>
                        </div>
                    </div>

                    {/* Quick Action */}
                    <div className="flex justify-end">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate('/explorar')}
                            className="text-neon-green hover:bg-neon-green/10 flex items-center gap-2 h-auto py-2"
                        >
                            <TrendingUp className="h-4 w-4" />
                            <span className="text-right">
                                <span className="block text-xs font-normal text-muted-foreground">Ver datos históricos</span>
                                <span className="block font-medium">Mapa de Calor</span>
                            </span>
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

function EmptyUserZone({ onSetup, isUpdating }: { onSetup: () => void, isUpdating: boolean }) {
    return (
        <Card className="mb-6 border-dashed border-2 border-border/50">
            <CardContent className="p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-full bg-muted">
                        <MapPin className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                        <h3 className="font-medium">Configurar "Tu Zona"</h3>
                        <p className="text-sm text-muted-foreground">
                            Personaliza tu experiencia y recibe alertas locales.
                        </p>
                    </div>
                </div>
                <Button
                    onClick={onSetup}
                    disabled={isUpdating}
                    variant="default"
                    className="bg-neon-green text-black hover:bg-neon-green/90"
                >
                    {isUpdating ? 'Activando...' : 'Activar'}
                </Button>
            </CardContent>
        </Card>
    )
}

function UserZoneSkeleton() {
    return (
        <Card className="mb-6">
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-4 mb-4">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-6 w-48" />
                    </div>
                </div>
                <div className="h-20 w-full rounded-md bg-muted/50" />
            </CardContent>
        </Card>
    )
}
