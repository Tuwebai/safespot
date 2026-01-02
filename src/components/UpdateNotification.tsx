import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

/**
 * Update Notification Component
 * Shows a modal when a new version of the app is available
 * Prompts user to reload to get the latest version
 */
export function UpdateNotification() {
    const [showUpdate, setShowUpdate] = useState(false)
    const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null)

    useEffect(() => {
        // Check if service worker is supported
        if (!('serviceWorker' in navigator)) return

        // Listen for service worker updates
        navigator.serviceWorker.ready.then((reg) => {
            setRegistration(reg)

            // Check for updates every 60 seconds
            const interval = setInterval(() => {
                reg.update()
            }, 60000)

            // Listen for new service worker waiting
            reg.addEventListener('updatefound', () => {
                const newWorker = reg.installing
                if (!newWorker) return

                newWorker.addEventListener('statechange', () => {
                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        // New version available
                        setShowUpdate(true)
                    }
                })
            })

            return () => clearInterval(interval)
        })

        // Also listen for messages from service worker
        navigator.serviceWorker.addEventListener('message', (event) => {
            if (event.data?.type === 'UPDATE_AVAILABLE') {
                setShowUpdate(true)
            }
        })
    }, [])

    const handleUpdate = () => {
        if (registration?.waiting) {
            // Tell the service worker to skip waiting
            registration.waiting.postMessage({ type: 'SKIP_WAITING' })
        }
        // Reload the page
        window.location.reload()
    }

    if (!showUpdate) return null

    return (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center p-4 pointer-events-none">
            <Card className="w-full max-w-md pointer-events-auto animate-in slide-in-from-bottom-5 duration-300 bg-dark-card border-dark-border shadow-2xl">
                <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-neon-green/10 flex items-center justify-center">
                            <RefreshCw className="w-5 h-5 text-neon-green" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold text-foreground mb-1">
                                Nueva versión disponible
                            </h3>
                            <p className="text-sm text-foreground/70 mb-4">
                                Hay una actualización de SafeSpot lista. Recargá la página para obtener las últimas mejoras y correcciones.
                            </p>
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleUpdate}
                                    className="bg-neon-green hover:bg-neon-green/90 text-dark-bg font-medium"
                                >
                                    Actualizar ahora
                                </Button>
                                <Button
                                    onClick={() => setShowUpdate(false)}
                                    variant="ghost"
                                    className="text-foreground/60 hover:text-foreground"
                                >
                                    Más tarde
                                </Button>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
