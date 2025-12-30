import { useEffect, useState } from 'react'
import type { Report } from '@/lib/api'

interface SafeSpotMapProps {
    reports: Report[]
    className?: string
    onSearchArea?: () => void
    initialFocus?: { focusReportId: string, lat: number, lng: number } | null
    isSearching?: boolean
}

/**
 * Client-only map wrapper
 * This component ensures react-leaflet NEVER executes during SSR or build
 * by dynamically importing the actual map component only in the browser
 */
export function SafeSpotMap(props: SafeSpotMapProps) {
    const [MapComponent, setMapComponent] = useState<any>(null)

    useEffect(() => {
        // Only load map in browser
        if (typeof window === 'undefined') return

        // Dynamic import of the actual map component
        // This prevents react-leaflet from being bundled in the initial load
        import('./SafeSpotMapClient').then((mod) => {
            setMapComponent(() => mod.SafeSpotMapClient)
        }).catch((error) => {
            console.error('Failed to load map:', error)
        })
    }, [])

    // Show loading state while map loads
    if (!MapComponent) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-dark-bg">
                <div className="text-center">
                    <div className="animate-spin h-12 w-12 border-4 border-neon-green border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-foreground/60">Cargando mapa...</p>
                </div>
            </div>
        )
    }

    return <MapComponent {...props} />
}
