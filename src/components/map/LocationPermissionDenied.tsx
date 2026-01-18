import { Button } from '@/components/ui/button'
import { MapPinOff } from 'lucide-react'

interface LocationPermissionDeniedProps {
    onRetry: () => void
}

export function LocationPermissionDenied({ onRetry }: LocationPermissionDeniedProps) {
    return (
        <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-dark-bg p-6">
            <div className="max-w-md w-full text-center space-y-6">
                <div className="mx-auto w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                    <MapPinOff className="w-10 h-10 text-destructive" />
                </div>

                <h2 className="text-2xl font-bold text-white">
                    Ubicación Desactivada
                </h2>

                <p className="text-muted-foreground text-base leading-relaxed">
                    Para mostrarte reportes de seguridad relevantes en tu zona, necesitamos acceso a tu ubicación.
                    SafeSpot no funciona correctamente sin saber dónde estás.
                </p>

                <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 text-left">
                    <p className="text-xs text-destructive/80 font-mono">
                        Si ya bloqueaste el permiso, tenés que habilitarlo manualmente en la configuración de sitio de tu navegador.
                    </p>
                </div>

                <Button
                    onClick={onRetry}
                    className="w-full h-12 text-base font-semibold bg-white text-black hover:bg-gray-200"
                >
                    Intentar de nuevo
                </Button>
            </div>
        </div>
    )
}
