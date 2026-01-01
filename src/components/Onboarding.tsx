import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import Joyride, { CallBackProps, STATUS, Step, EVENTS } from 'react-joyride'

export function Onboarding() {
    const [run, setRun] = useState(false)
    const location = useLocation()

    // Detectar si es la primera visita
    useEffect(() => {
        const hasSeenTour = localStorage.getItem('safespot_onboarding_completed')
        // Solo mostrar en Home page
        if (!hasSeenTour && location.pathname === '/') {
            // Esperar 2 segundos para que la página cargue completamente
            const timer = setTimeout(() => {
                setRun(true)
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [location.pathname])

    // Pasos solo para la página Home
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
                        Te mostraremos las funciones principales en 3 pasos rápidos.
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
            disableBeacon: true,
        },
        {
            target: '.onboarding-create-report',
            content: (
                <div className="space-y-2">
                    <h3 className="text-lg font-bold flex items-center gap-2">
                        <span>📝</span> Crear tu Primer Reporte
                    </h3>
                    <p className="text-sm">
                        Reporta incidentes de seguridad y ayuda a tu comunidad.
                    </p>
                    <div className="bg-neon-green/10 border border-neon-green/30 rounded-lg p-2 mt-2">
                        <p className="text-xs text-neon-green font-semibold">
                            🔒 Tu identidad es 100% anónima
                        </p>
                        <p className="text-xs text-muted-foreground">
                            No guardamos datos personales, solo un ID único.
                        </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                        💡 <strong>Tip:</strong> Visita tu <strong>Perfil</strong> para ver el sistema de gamificación y configurar zonas de alerta.
                    </p>
                </div>
            ),
            placement: 'bottom',
            disableBeacon: true,
        },
    ]

    const handleJoyrideCallback = (data: CallBackProps) => {
        const { status, action, type } = data
        const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED]

        // Si el tour se salta un paso porque no encuentra el target, continuar
        if (type === EVENTS.TARGET_NOT_FOUND) {
            console.warn('Onboarding: Target not found, skipping step')
            return
        }

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
            disableOverlayClose
            disableScrolling={false}
            scrollToFirstStep
            scrollOffset={100}
            spotlightPadding={8}
            callback={handleJoyrideCallback}
            styles={{
                options: {
                    primaryColor: '#39FF14',
                    zIndex: 10000,
                    arrowColor: '#1a1a1a',
                    backgroundColor: '#1a1a1a',
                    textColor: '#ffffff',
                    overlayColor: 'rgba(0, 0, 0, 0.8)',
                },
                overlay: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                },
                spotlight: {
                    borderRadius: '12px',
                    boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 30px 10px rgba(57, 255, 20, 0.5)',
                },
                tooltip: {
                    backgroundColor: '#1a1a1a',
                    borderRadius: '16px',
                    color: '#ffffff',
                    padding: '20px',
                    border: '2px solid rgba(57, 255, 20, 0.3)',
                    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(57, 255, 20, 0.2)',
                },
                tooltipContainer: {
                    textAlign: 'left',
                },
                buttonNext: {
                    backgroundColor: '#39FF14',
                    color: '#000000',
                    borderRadius: '8px',
                    fontWeight: 'bold',
                    padding: '10px 20px',
                    fontSize: '14px',
                    border: 'none',
                    cursor: 'pointer',
                },
                buttonBack: {
                    color: '#39FF14',
                    marginRight: '10px',
                    padding: '10px 16px',
                },
                buttonSkip: {
                    color: '#888888',
                    padding: '10px 16px',
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
