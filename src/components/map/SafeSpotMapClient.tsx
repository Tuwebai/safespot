import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, ZoomControl } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Button } from '@/components/ui/button'
import { getMarkerIcon } from '@/lib/map-utils'
import type { Report } from '@/lib/api'
import { Navigation, Calendar, Search } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMapStore } from '@/lib/store/useMapStore'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

// Fix for default marker icon issues
import L from 'leaflet'
// @ts-expect-error - Leaflet icon internal property deletion
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
    iconRetinaUrl: null,
    iconUrl: null,
    shadowUrl: null,
})

const RecenterButton = () => {
    const map = useMap()
    const handleRecenter = () => {
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition((position) => {
                const { latitude, longitude } = position.coords
                map.flyTo([latitude, longitude], 15, { duration: 1.5 })
            })
        }
    }
    return (
        <div className="leaflet-bottom leaflet-right">
            <div className="leaflet-control leaflet-bar">
                <Button
                    size="icon"
                    variant="secondary"
                    className="h-10 w-10 rounded-md shadow-md bg-white hover:bg-gray-100 text-dark-bg border border-gray-200"
                    onClick={handleRecenter}
                    title="Centrar en mi ubicación"
                >
                    <Navigation className="h-5 w-5" />
                </Button>
            </div>
        </div>
    )
}

const SearchAreaButton = ({ onClick, visible, loading }: { onClick: () => void, visible: boolean, loading?: boolean }) => {
    if (!visible && !loading) return null
    return (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[400] animate-in fade-in slide-in-from-top-4">
            <Button
                onClick={onClick}
                disabled={loading}
                className="rounded-full shadow-xl bg-white text-black hover:bg-gray-50 border border-gray-200 px-6 font-semibold"
            >
                {loading ? (
                    <>
                        <span className="animate-spin mr-2">⏳</span>
                        Buscando...
                    </>
                ) : (
                    <>
                        <Search className="w-4 h-4 mr-2" />
                        Buscar en esta zona
                    </>
                )}
            </Button>
        </div>
    )
}

function MapEvents() {
    const setShowSearchAreaButton = useMapStore(s => s.setShowSearchAreaButton)
    const setMapBounds = useMapStore(s => s.setMapBounds)

    useMapEvents({
        moveend: (e) => {
            const bounds = e.target.getBounds()
            setMapBounds({
                south: bounds.getSouth(),
                west: bounds.getWest(),
                north: bounds.getNorth(),
                east: bounds.getEast()
            })
            setShowSearchAreaButton(true)
        }
    })
    return null
}

// ... MapSync ...

function MapSync({ reports }: { reports: Report[] }) {
    const map = useMap()
    const selectedReportId = useMapStore(s => s.selectedReportId)

    useEffect(() => {
        if (selectedReportId) {
            const report = reports.find(r => r.id === selectedReportId)
            // Guard against undefined coordinates
            if (report && typeof report.latitude === 'number' && typeof report.longitude === 'number') {
                map.flyTo([report.latitude, report.longitude], 16, { duration: 1.5 })
            }
        }
    }, [selectedReportId, reports, map])
    return null
}

interface SafeSpotMapProps {
    reports: Report[]
    className?: string
    onSearchArea?: () => void
    initialFocus?: { focusReportId: string, lat: number, lng: number } | null
    isSearching?: boolean
}

export function SafeSpotMapClient({ reports, className, onSearchArea, initialFocus, isSearching }: SafeSpotMapProps) {
    const defaultCenter: [number, number] = initialFocus
        ? [initialFocus.lat, initialFocus.lng]
        : [-34.6037, -58.3816]

    const defaultZoom = initialFocus ? 16 : 13
    const showSearchButton = useMapStore(s => s.showSearchAreaButton)
    const highlightedId = useMapStore(s => s.highlightedReportId)

    // Filter out reports with invalid coordinates to prevent crashes
    // Generic debug logging


    // Robust parsing of coordinates to ensure valid numbers
    const validReports = reports
        .map(r => ({
            ...r,
            latitude: Number(r.latitude),
            longitude: Number(r.longitude)
        }))
        .filter(r => {
            const isValid =
                !isNaN(r.latitude) &&
                !isNaN(r.longitude) &&
                r.latitude !== 0 &&
                r.longitude !== 0


            return isValid
        })




    return (
        <div className={`relative w-full h-full min-h-[500px] bg-slate-100 z-0 ${className}`}>
            <MapContainer
                center={defaultCenter}
                zoom={defaultZoom}
                scrollWheelZoom={true}
                touchZoom={true}
                doubleClickZoom={true}
                zoomControl={false}
                dragging={true}
                className="w-full h-full"
                style={{ height: '100%', width: '100%' }}
            >
                <ZoomControl position="bottomright" />
                <MapEvents />
                <MapSync reports={reports} />
                <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
                />

                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={60}
                    spiderfyOnMaxZoom={true}
                >
                    {validReports.map((report) => (
                        <Marker
                            key={report.id}
                            position={[report.latitude as number, report.longitude as number]} // Force type assertion as we filtered
                            icon={getMarkerIcon({
                                category: report.category,
                                status: report.status,
                                isHighlighted: highlightedId === report.id
                            })}
                        >
                            <Popup className="custom-popup">
                                <div className="min-w-[200px] p-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground border px-1 rounded">{report.category}</span>
                                    </div>
                                    <h4 className="font-bold text-sm mb-1 line-clamp-2">{report.title}</h4>

                                    <div className="flex items-center text-xs text-muted-foreground mb-3">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(report.created_at).toLocaleDateString()}
                                    </div>

                                    <Link to={`/reporte/${report.id}`}>
                                        <Button size="sm" variant="neon" className="w-full h-8 text-xs">
                                            Ver Detalles
                                        </Button>
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}
                </MarkerClusterGroup>

                <RecenterButton />
                <SearchAreaButton
                    onClick={() => onSearchArea && onSearchArea()}
                    visible={showSearchButton}
                    loading={isSearching}
                />
            </MapContainer>
        </div>
    )
}
