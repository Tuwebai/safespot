import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'


// Fix for leaflet marker icons in React/Vite
// @ts-expect-error - Leaflet icon internal property deletion
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface ReportMapFallbackProps {
    lat?: number
    lng?: number
    className?: string
}

export function ReportMapFallback({ lat, lng, className }: ReportMapFallbackProps) {
    const hasLocation = typeof lat === 'number' && typeof lng === 'number'

    // Default center (Cordoba/Argentina) if no location provided
    const defaultCenter: [number, number] = [-31.4161, -64.1867]

    // Memoize center
    const center = useMemo<[number, number]>(() => {
        if (hasLocation) return [lat!, lng!]
        return defaultCenter
    }, [lat, lng, hasLocation])

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
                    // CartoDB Voyager (cleaner looking for UI fallbacks)
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                />
                {hasLocation && <Marker position={center} />}
            </MapContainer>

            {/* Overlay gradient for text readability if title is over map */}
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent pointer-events-none z-[400]" />

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
