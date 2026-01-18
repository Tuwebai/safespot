import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'




// NOTE: Global Leaflet icon setup is handled in App.tsx via leaflet-setup.ts


interface ReportMapFallbackProps {
    lat?: number | string
    lng?: number | string
    className?: string
}

export function ReportMapFallback({ lat, lng, className }: ReportMapFallbackProps) {
    const numLat = typeof lat === 'string' ? parseFloat(lat) : lat
    const numLng = typeof lng === 'string' ? parseFloat(lng) : lng
    const hasLocation = typeof numLat === 'number' && typeof numLng === 'number' && !isNaN(numLat) && !isNaN(numLng)

    // Default center (Cordoba/Argentina) if no location provided
    const defaultCenter: [number, number] = [-31.4161, -64.1867]

    // Memoize center
    const center = useMemo<[number, number]>(() => {
        if (hasLocation) return [numLat!, numLng!]
        return defaultCenter
    }, [numLat, numLng, hasLocation])

    return (
        <div className={`w-full h-full relative z-0 ${className}`}>
            <MapContainer
                center={center}
                zoom={hasLocation ? 15 : 12} // Lower zoom if no specific location
                scrollWheelZoom={false}
                dragging={false}   // Non-interactive
                zoomControl={false} // Clean look
                attributionControl={false}
                doubleClickZoom={false}
                boxZoom={false}
                keyboard={false}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {hasLocation && <Marker position={center} />}
            </MapContainer>

            {/* Gradient removed for better legibility as requested by user */}

            {!hasLocation && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/10 z-[401] pointer-events-none">
                    <span className="text-[10px] font-medium bg-background/80 backdrop-blur-sm px-2 py-1 rounded-full border border-border text-muted-foreground">
                        Ubicación aproximada
                    </span>
                </div>
            )}
        </div>
    )
}
