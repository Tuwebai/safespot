import { useState, useEffect } from 'react'
import Joyride, { CallBackProps, STATUS, Step } from 'react-joyride'

export function Onboarding() {
    const [run, setRun] = useState(false)

    // Detectar si es la primera visita
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('safespot_onboarding_completed')
        if (!hasSeenTour) {
            // Esperar 1 segundo para que la página cargue completamente
            const timer = setTimeout(() => {
                setRun(true)
            }, 1000)
            return () => clearTimeout(timer)
        }
    }, [])

    const steps: Step[] = [
        {
            target: 'body',
            content: (
                <div className="space-y-3">
                    <h2 className="text-2xl font-bold">¡Bienvenido a SafeSpot! 🎉</h2>
                    <p className="text-base">
                        Tu plataforma anónima para reportar y prevenir incidentes de seguridad.
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Te mostraremos las funciones principales en 5 pasos rápidos.
                    </p>
                </div>
            ),
            placement: 'center',
            disableBeacon: true,
        },
        {
            target: '.onboarding-map',
            content: (
                <div className="space-y-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>🗺️</span> Mapa de Reportes
                    </h3>
                    <p className="text-sm">
                        Visualiza todos los incidentes reportados en tu zona en tiempo real.
                    </p>
                    <ul className="text-xs text-muted-foreground space-y-1 ml-4 list-disc">
                        <li>Haz clic en un marcador para ver detalles</li>
                        <li>Filtra por categoría (Celulares, Motos, etc.)</li>
                        <li>Zoom para explorar diferentes áreas</li>
                    </ul>
                </div>
            ),
            placement: 'bottom',
            spotlightClicks: true,
        },
        {
            target: '.onboarding-gamification',
            content: (
                <div className="space-y-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>🏆</span> Sistema de Gamificación
                    </h3>
                    <p className="text-sm">
                        Gana puntos e insignias por ayudar a la comunidad:
                    </p>
                    <ul className="text-xs space-y-1 ml-4 list-disc">
                        <li><strong>Crear reportes:</strong> 10-50 puntos</li>
                        <li><strong>Comentar:</strong> 5 puntos</li>
                        <li><strong>Votar reportes útiles:</strong> 2 puntos</li>
                    </ul>
                    <p className="text-xs text-neon-green mt-2">
                        ¡Desbloquea 50 insignias únicas hasta nivel 50!
                    </p>
                </div>
            ),
            placement: 'left',
        },
        {
            target: '.onboarding-zones',
            content: (
                <div className="space-y-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>📍</span> Zonas de Alerta
                    </h3>
                    <p className="text-sm">
                        Configura lugares importantes para recibir notificaciones:
                    </p>
                    <ul className="text-xs space-y-1 ml-4 list-disc">
                        <li><strong>Casa:</strong> Tu hogar</li>
                        <li><strong>Trabajo:</strong> Tu oficina</li>
                        <li><strong>Frecuentes:</strong> Lugares que visitas seguido</li>
                    </ul>
                    <p className="text-xs text-muted-foreground mt-2">
                        Te avisaremos cuando haya reportes cerca de estas zonas.
                    </p>
                </div>
            ),
            placement: 'top',
        },
        {
            target: '.onboarding-create-report',
            content: (
                <div className="space-y-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>📝</span> Crear tu Primer Reporte
                    </h3>
                    <p className="text-sm">
                        ¡Listo! Ahora puedes crear tu primer reporte y empezar a ganar puntos.
                    </p>
                    <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-2 mt-2">
                        <p className="text-xs text-neon-green font-semibold">
                            🔒 Tu identidad es 100% anónima
                        </p>
                        <p className="text-xs text-muted-foreground">
                            No guardamos datos personales, solo un ID único.
                        </p>
                    </div>
                </div>
            ),
            placement: 'bottom',
        },
    ]

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status } = data
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]

        if (finishedStatuses.includes(status)) {
            setRun(false)
            localStorage.setItem('safespot_onboarding_completed', 'true')
        }
    }

    return (
        <Joyride
            steps={steps}
            run={run}
            continuous
            showProgress
            showSkipButton
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#39FF14',
                    zIndex: 10000,
                    arrowColor: '#1a1a1a',
                    backgroundColor: '#1a1a1a',
                    textColor: '#ffffff',
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    color: '#ffffff',
                    padding: '20px',
                    border: '1px solid rgba(57, 255, 20, 0.2)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                buttonNext: {
                    backgroundColor: '#39FF14',
                    color: '#000000',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    padding: '8px 16px',
                    fontSize: '14px',
                },
                buttonBack: {
                    color: '#39FF14',
                    marginRight: '8px',
                },
                buttonSkip: {
                    color: '#888888',
                },
                spotlight: {
                    borderRadius: '12px',
                },
            }}
            locale={{
                back: 'Atrás',
                close: 'Cerrar',
                last: 'Finalizar',
                next: 'Siguiente',
                skip: 'Saltar tour',
            }}
        />
    )
}
