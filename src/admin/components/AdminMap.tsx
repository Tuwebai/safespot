import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import { useAdminHeatmap } from '../hooks/useAdminHeatmap'

// Buenos Aires default center
const DEFAULT_CENTER = [-34.6037, -58.3816] as [number, number]
const DEFAULT_ZOOM = 12

// Dark tile provider (CartoDB Dark Matter)
const DARK_TILES_URL = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
const DARK_TILES_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'

export default function AdminMap() {
    const { data, isLoading } = useAdminHeatmap()

    if (isLoading) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-[#020617] text-[#00ff88]">
                <span className="animate-pulse">Loading Satellite Data...</span>
            </div>
        )
    }

    const features = data?.features || []

    return (
        <div className="w-full h-full rounded-lg overflow-hidden border border-[#1e293b]/50 relative z-0">
            {/* Map Container */}
            <MapContainer
                center={DEFAULT_CENTER}
                zoom={DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%', background: '#020617' }}
                zoomControl={false}
                attributionControl={false}
            >
                <TileLayer
                    url={DARK_TILES_URL}
                    attribution={DARK_TILES_ATTRIBUTION}
                />

                {/* 
                    Heatmap Simulation:
                    Increased intensity for better visibility.
                */}
                {features.map((feature) => {
                    const [lng, lat] = feature.geometry.coordinates
                    return (
                        <CircleMarker
                            key={feature.properties.id}
                            center={[lat, lng]}
                            pathOptions={{
                                color: '#ef4444',
                                fillColor: '#ef4444',
                                fillOpacity: 0.4, // Increased from 0.15
                                weight: 0
                            }}
                            radius={25} // Increased from 8 to simulate larger heat zones
                        />
                    )
                })}

                {/* Core hotspots */}
                {features.map((feature) => {
                    const [lng, lat] = feature.geometry.coordinates
                    return (
                        <CircleMarker
                            key={`core-${feature.properties.id}`}
                            center={[lat, lng]}
                            pathOptions={{
                                color: '#fbbf24', // Amber for core
                                fillColor: '#fbbf24',
                                fillOpacity: 0.9,
                                weight: 0
                            }}
                            radius={4}
                        />
                    )
                })}

            </MapContainer>

            {/* Overlay UI (Legend / Controls can go here) */}
            <div className="absolute top-4 right-4 z-[400] bg-[#0f172a]/90 backdrop-blur px-3 py-2 rounded border border-[#334155] text-xs">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                    <span className="text-slate-300">Incident Zone</span>
                </div>
            </div>
        </div>
    )
}
