import { useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import { MapPin } from 'lucide-react'

// Fix for leaflet marker icons in React/Vite
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;

L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MiniMapPreviewProps {
    lat?: number
    lng?: number
}

// Component to handle map center updates
function ChangeView({ center }: { center: [number, number] }) {
    const map = useMap()
    useEffect(() => {
        map.setView(center, 16) // Zoom 16 for clarity
    }, [center, map])
    return null
}

export function MiniMapPreview({ lat, lng }: MiniMapPreviewProps) {
    const hasLocation = typeof lat === 'number' && typeof lng === 'number'

    // Memoize center to prevent unnecessary re-renders
    const center = useMemo<[number, number]>(() => {
        if (hasLocation) return [lat!, lng!]
        return [-31.416, -64.186] // Default Cordoba Center
    }, [lat, lng, hasLocation])

    if (!hasLocation) {
        return (
            <div className="w-full h-[200px] rounded-lg border border-dark-border/50 mt-4 bg-dark-bg/50 flex flex-col items-center justify-center text-muted-foreground gap-2 animate-in fade-in duration-300">
                <div className="bg-dark-card p-3 rounded-full border border-dark-border">
                    <MapPin className="h-6 w-6 opacity-50" />
                </div>
                <span className="text-sm">Selecciona una ubicación para ver el mapa</span>
            </div>
        )
    }

    return (
        <div className="w-full h-[220px] rounded-lg overflow-hidden border border-neon-green/30 mt-4 shadow-lg animate-in fade-in duration-500 relative z-0">
            <MapContainer
                center={center}
                zoom={16}
                scrollWheelZoom={true} // Enabled interaction
                dragging={true}
                zoomControl={true}
                attributionControl={false}
                doubleClickZoom={true}
                style={{ height: '100%', width: '100%' }}
            >
                <TileLayer
                    // Using Standard OSM for maximum legibility (Streets)
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                <Marker position={center} />
                <ChangeView center={center} />
            </MapContainer>
        </div>
    )
}
