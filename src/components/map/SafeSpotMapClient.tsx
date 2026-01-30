import { divIcon } from 'leaflet'
import { useState, useEffect, Fragment } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, ZoomControl, Circle } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Button } from '@/components/ui/button'
import { ZoneType } from '@/lib/constants'
import { Navigation, Search, ShieldAlert, Home, Briefcase, MapPin, X, Trash2 } from 'lucide-react'
import { useMapStore } from '@/lib/store/useMapStore'
import { useUserZones } from '@/hooks/useUserZones'
import { useReport, useReportsBatch } from '@/hooks/queries/useReportsQuery'
import { useSettingsQuery } from '@/hooks/queries/useSettingsQuery'
import { useLocationAuthority, LocationState } from '@/hooks/useLocationAuthority'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { LocationPermissionDenied } from './LocationPermissionDenied'
import { SafeSpotMapMarker } from './SafeSpotMapMarker'

// Add custom style for placement mode cursor
// Extracted CenterManager to prevent re-mounting loops
const CenterManager = ({
    activeZoneType,
}: {
    activeZoneType: ZoneType | null,
}) => {
    const map = useMap()

    // EXPLICIT: Ensure dragging is ENABLED in placement mode
    useEffect(() => {
        if (!map) return
        if (activeZoneType) {
            map.dragging.enable()
        }
    }, [map, activeZoneType])

    return null
}

// Helper to create the 3D Pin Icon as a static SVG Data URI
// Senior Architect Note: Using static images (L.icon) instead of divIcon reduces DOM nodes
// and allows the browser to optimize rendering via GPU.
import L from 'leaflet'

const createPinIcon = (color: string) => {
    const svg = `
        <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                    <feOffset dx="0" dy="2" result="offsetblur" />
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.5" />
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <g filter="url(#shadow)">
                <path d="M20 0C11.164 0 4 7.164 4 16C4 26 20 40 20 40C20 40 36 26 36 16C36 7.164 28.836 0 20 0Z" fill="${color}"/>
                <path d="M20 0C11.164 0 4 7.164 4 16C4 26 20 40 20 40C20 40 36 26 36 16C36 7.164 28.836 0 20 0Z" stroke="#FFFFFF" stroke-width="2"/>
                <circle cx="20" cy="16" r="6" fill="#FFFFFF"/>
            </g>
        </svg>
    `.trim()

    return L.icon({
        iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
        iconSize: [40, 40],
        iconAnchor: [20, 40],
        popupAnchor: [0, -40],
        className: 'marker-pin-svg'
    })
}



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

const ZoneMarkers = () => {
    const { zones, deleteZone } = useUserZones()
    const [confirmingDelete, setConfirmingDelete] = useState<ZoneType | null>(null)

    const zoneStyles = {
        home: { color: '#22c55e', fillColor: '#22c55e' }, // Emerald-500
        work: { color: '#3b82f6', fillColor: '#3b82f6' }, // Blue-500
        frequent: { color: '#f59e0b', fillColor: '#f59e0b' } // Amber-500
    }

    return (
        <>
            {zones.map(zone => {
                const style = zoneStyles[zone.type as keyof typeof zoneStyles]
                if (!style) return null // 🛑 GUARD: Prevents crash if zone type is 'current' or unknown

                const color = style.color
                const pinIcon = createPinIcon(color)

                return (
                    <Fragment key={zone.id}>
                        {/* Zone Radius */}
                        <Circle
                            center={[zone.lat, zone.lng]}
                            radius={zone.radius_meters}
                            pathOptions={{
                                ...style,
                                fillOpacity: 0.15,
                                weight: 2,
                                dashArray: '5, 5'
                            }}
                            interactive={false} // Pass interaction to Marker
                        />
                        {/* Persistent 3D Pin */}
                        <Marker
                            position={[zone.lat, zone.lng]}
                            icon={pinIcon}
                        >
                            <Popup eventHandlers={{ add: () => setConfirmingDelete(null) }}>
                                <div
                                    key={confirmingDelete ? 'confirm' : 'idle'}
                                    className="p-2 min-w-[160px] min-h-[80px] flex flex-col justify-center"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <div className="flex items-center gap-2 mb-3">
                                        <div className={`p-1.5 rounded-lg ${zone.type === 'home' ? 'bg-emerald-500/10' : zone.type === 'work' ? 'bg-blue-500/10' : 'bg-amber-500/10'}`}>
                                            {zone.type === 'home' && <Home className="w-4 h-4 text-emerald-500" />}
                                            {zone.type === 'work' && <Briefcase className="w-4 h-4 text-blue-500" />}
                                            {zone.type === 'frequent' && <MapPin className="w-4 h-4 text-amber-500" />}
                                        </div>
                                        <span className="font-bold text-sm capitalize">{zone.type === 'home' ? 'Casa' : zone.type === 'work' ? 'Trabajo' : 'Zona Frecuente'}</span>
                                    </div>

                                    {confirmingDelete === zone.type ? (
                                        <div className="flex flex-col gap-2 animate-in zoom-in-95 duration-200">
                                            <p className="text-[10px] text-muted-foreground font-medium text-center mb-1 leading-tight">
                                                ¿Estás seguro de eliminar esta zona?
                                            </p>
                                            <div className="flex gap-2">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    className="flex-1 h-8 text-[11px]"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        setConfirmingDelete(null)
                                                    }}
                                                >
                                                    No, volver
                                                </Button>
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    className="flex-1 h-8 text-[11px] font-bold"
                                                    onClick={(e) => {
                                                        e.stopPropagation()
                                                        deleteZone(zone.type)
                                                        setConfirmingDelete(null)
                                                    }}
                                                >
                                                    Sí, borrar
                                                </Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            className="w-full h-9 gap-2 text-[11px] font-semibold bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 transition-all duration-200"
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                setConfirmingDelete(zone.type)
                                            }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            Eliminar Zona
                                        </Button>
                                    )}
                                </div>
                            </Popup>
                        </Marker>
                    </Fragment>
                )
            })}
        </>
    )
}

const AlertZoneControl = ({ activeType, setActiveType }: { activeType: ZoneType | null, setActiveType: (t: ZoneType | null) => void }) => {
    return (
        <div className="absolute top-2 sm:top-20 left-2 sm:left-4 z-[1000] flex flex-col gap-2 scale-90 sm:scale-100 origin-top-left">
            <div className="bg-zinc-950 p-2 sm:p-3 rounded-2xl border border-zinc-800 shadow-[0_0_30px_rgba(0,0,0,0.6)] flex flex-col gap-2 sm:gap-3 min-w-[180px] sm:min-w-[200px]">
                <div className="flex items-center justify-between gap-2 sm:gap-4 px-1">
                    <div className="flex items-center gap-2">
                        <div className="p-1 sm:p-1.5 bg-neon-green/10 rounded-lg">
                            <ShieldAlert className="w-3.5 h-3.5 sm:w-4 h-4 text-neon-green" />
                        </div>
                        <span className="font-bold text-[10px] sm:text-xs text-white tracking-tight">MODO ALERTA</span>
                    </div>
                    {activeType && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-white/10"
                            onClick={() => setActiveType(null)}
                        >
                            <X className="w-3.5 h-3.5" />
                        </Button>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                    <Button
                        variant={activeType === 'home' ? 'default' : 'ghost'}
                        size="sm"
                        className={`justify-start gap-3 h-10 px-3 rounded-xl transition-all duration-200 ${activeType === 'home' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)] text-white' : 'hover:bg-zinc-800 text-zinc-300 hover:text-emerald-500'}`}
                        onClick={() => setActiveType(activeType === 'home' ? null : 'home')}
                    >
                        <Home className="w-4 h-4" />
                        <span className="text-xs font-semibold">Casa</span>
                    </Button>
                    <Button
                        variant={activeType === 'work' ? 'default' : 'ghost'}
                        size="sm"
                        className={`justify-start gap-3 h-10 px-3 rounded-xl transition-all duration-200 ${activeType === 'work' ? 'bg-blue-500 hover:bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.3)] text-white' : 'hover:bg-zinc-800 text-zinc-300 hover:text-blue-500'}`}
                        onClick={() => setActiveType(activeType === 'work' ? null : 'work')}
                    >
                        <Briefcase className="w-4 h-4" />
                        <span className="text-xs font-semibold">Trabajo</span>
                    </Button>
                    <Button
                        variant={activeType === 'frequent' ? 'default' : 'ghost'}
                        size="sm"
                        className={`justify-start gap-3 h-10 px-3 rounded-xl transition-all duration-200 ${activeType === 'frequent' ? 'bg-amber-500 hover:bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.3)] text-white' : 'hover:bg-zinc-800 text-zinc-300 hover:text-amber-500'}`}
                        onClick={() => setActiveType(activeType === 'frequent' ? null : 'frequent')}
                    >
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-semibold">Zona Frecuente</span>
                    </Button>
                </div>

                {activeType && (
                    <div className="px-3 py-2 bg-neon-green/10 rounded-xl border border-neon-green/20 animate-pulse">
                        <p className="text-[10px] text-neon-green font-bold text-center leading-tight">
                            Hacé click en el mapa para ubicar tu {activeType === 'home' ? 'Casa' : activeType === 'work' ? 'Trabajo' : 'Zona'}
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}

function MouseTracker({ activeType, isSaving }: { activeType: ZoneType | null, isSaving: boolean }) {
    const [mousePos, setMousePos] = useState<[number, number] | null>(null)

    useMapEvents({
        mousemove: (e) => {
            if (activeType) {
                setMousePos([e.latlng.lat, e.latlng.lng])
            }
        }
    })

    if (!activeType || !mousePos) return null

    // Show spinner if saving
    if (isSaving) {
        return (
            <Marker
                position={mousePos}
                interactive={false}
                icon={divIcon({
                    html: `<div class="animate-spin text-neon-green"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" class="stroke-current" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg></div>`,
                    className: 'bg-transparent',
                    iconSize: [32, 32],
                    iconAnchor: [16, 16]
                })}
                zIndexOffset={2000}
            />
        )
    }

    // Custom 3D Red Pin for Placement
    const redPinIcon = createPinIcon('#EF4444')

    return (
        <Marker
            position={mousePos}
            interactive={false}
            icon={redPinIcon}
            zIndexOffset={2000} // High z-index to stay on top
        />
    )
}


function MapClickListener({ activeType, onPlace }: { activeType: ZoneType | null, onPlace: (lat: number, lng: number) => void }) {
    useMapEvents({
        click: (e) => {
            if (activeType) {
                onPlace(e.latlng.lat, e.latlng.lng)
            }
        },
    })
    return null
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

function MapSync() {
    const map = useMap()
    const selectedReportId = useMapStore(s => s.selectedReportId)
    const { data: report } = useReport(selectedReportId || '')

    useEffect(() => {
        if (selectedReportId && report) {
            const lat = Number(report.latitude)
            const lng = Number(report.longitude)

            // Guard against undefined/invalid coordinates
            if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
                map.flyTo([lat, lng], 16, { duration: 1.5 })
            }
        }
    }, [selectedReportId, report, map])
    return null
}

interface SafeSpotMapProps {
    reportIds: string[]
    className?: string
    onSearchArea?: () => void
    initialFocus?: { focusReportId?: string, lat: number, lng: number } | null
    isSearching?: boolean
    activateZoneType?: ZoneType | null
    hideControls?: boolean
}

export function SafeSpotMapClient({
    reportIds,
    className,
    onSearchArea,
    initialFocus,
    isSearching,
    activateZoneType: externalActivateZoneType,
    hideControls
}: SafeSpotMapProps) {
    // --- LOAD SAVED SETTINGS ---
    const mapStyle = typeof window !== 'undefined' ? (localStorage.getItem('safespot_map_style') || 'streets') : 'streets';
    const cleanMap = typeof window !== 'undefined' ? (localStorage.getItem('safespot_map_density') === 'true') : false;

    const [activeZoneType, setActiveZoneType] = useState<ZoneType | null>(null)
    const { zones, saveZone } = useUserZones()

    // ✅ OPTIMIZATION: Resolve all reports in one batch for clustering
    const reports = useReportsBatch(reportIds)

    // ✅ Hook Integration for Settings (for fallbacks)
    const { data: settings } = useSettingsQuery()

    // ✅ MOTOR 5: Location Authority Engine
    const {
        state: locationState,
        position,
        statusMessage,
        retry,
        isResolved,
        isDenied,
        isUnavailable,
        isResolving
    } = useLocationAuthority({
        initialFocus: initialFocus ? { lat: initialFocus.lat, lng: initialFocus.lng } : null,
        zones: zones?.map(z => ({ type: z.type, lat: z.lat, lng: z.lng })) || null,
        lastKnown: settings?.last_known_lat && settings?.last_known_lng
            ? { lat: settings.last_known_lat, lng: settings.last_known_lng }
            : null,
        autoRequest: true
    })

    // Convert position to tuple for MapContainer
    const startPosition: [number, number] | null = position
        ? [position.lat, position.lng]
        : null

    // Sync external activation from props (e.g. from Profile)
    useEffect(() => {
        if (externalActivateZoneType) {
            setActiveZoneType(externalActivateZoneType)
        }
    }, [externalActivateZoneType])

    // Use the comprehensive top-level styles for placement mode
    const [isSavingZone, setIsSavingZone] = useState(false)

    const handlePlaceZone = async (lat: number, lng: number) => {
        if (!activeZoneType || isNaN(lat) || isNaN(lng) || isSavingZone) return

        setIsSavingZone(true)
        try {
            await saveZone({
                type: activeZoneType,
                lat,
                lng,
                radius_meters: 500
            })
            // Only exit mode on success
            setActiveZoneType(null)
        } catch (error) {
            console.error("Failed to save zone", error)
        } finally {
            setIsSavingZone(false)
        }
    }

    // Allow cancelling with Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && activeZoneType) {
                setActiveZoneType(null)
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [activeZoneType])

    // CRITICAL: Initialize Leaflet icons
    useEffect(() => {
        if (typeof window === 'undefined') return
        // Leaflet loaded
    }, [])

    const showSearchButton = useMapStore(s => s.showSearchAreaButton)

    // 🛑 BLOCK RENDER Logic - Consuming Location Authority Engine

    // 1. Permission Denied (Strict)
    if (isDenied) {
        return <LocationPermissionDenied onRetry={() => retry()} />;
    }

    // 2. Loading States (Resolving)
    if (isResolving || locationState === LocationState.UNKNOWN) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-dark-bg">
                <div className="text-center">
                    <div className="animate-spin h-12 w-12 border-4 border-neon-green border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-foreground/80 font-medium animate-pulse">{statusMessage || 'Iniciando geolocalización...'}</p>
                </div>
            </div>
        );
    }

    // 3. Unavailable
    if (isUnavailable) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-dark-bg p-6">
                <div className="max-w-xs text-center space-y-4">
                    <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center mb-2">
                        <MapPin className="w-8 h-8 text-yellow-500" />
                    </div>
                    <h3 className="text-lg font-bold text-white">Ubicación no disponible</h3>
                    <p className="text-sm text-muted-foreground">
                        {statusMessage || 'No pudimos detectarte automáticamente.'}
                    </p>
                    <Button
                        onClick={() => retry()}
                        className="w-full bg-white text-black hover:bg-gray-200"
                    >
                        Intentar de Nuevo
                    </Button>
                </div>
            </div>
        );
    }

    // 4. Not resolved yet (fallback)
    if (!isResolved || !startPosition) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-dark-bg">
                <div className="animate-spin h-8 w-8 border-2 border-white border-t-transparent rounded-full"></div>
            </div>
        )
    }

    // ✅ Only mount MapContainer when startPosition is known
    return (
        <div
            className={`relative w-full h-full min-h-[500px] bg-dark-bg z-0 ${className} ${activeZoneType ? 'map-placement-mode' : ''}`}
        >
            {/* Zone Management UI */}
            {!hideControls && <AlertZoneControl activeType={activeZoneType} setActiveType={setActiveZoneType} />}


            <MapContainer
                center={startPosition}
                zoom={14}
                scrollWheelZoom={true}
                dragging={true}
                doubleClickZoom={true}
                touchZoom={true}
                zoomControl={false}
                className={`w-full h-full ${activeZoneType ? 'map-placement-mode' : ''}`}
            >
                <CenterManager
                    activeZoneType={activeZoneType}
                />
                <ZoomControl position="bottomright" />
                <MapEvents />
                <MapClickListener activeType={activeZoneType} onPlace={handlePlaceZone} />
                <MouseTracker activeType={activeZoneType} isSaving={isSavingZone} />
                <MapSync />
                <ZoneMarkers />

                <TileLayer
                    attribution={mapStyle === 'streets' ? '&copy; CARTO' : '&copy; Esri'}
                    url={
                        mapStyle === 'satellite'
                            ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                            : mapStyle === 'hybrid'
                                ? "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
                    }
                />

                {mapStyle === 'hybrid' && (
                    <TileLayer
                        attribution="&copy; Esri"
                        url="https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"
                        zIndex={100}
                    />
                )}

                <MarkerClusterGroup
                    chunkedLoading
                    maxClusterRadius={cleanMap ? 80 : 60}
                    disableClusteringAtZoom={cleanMap ? undefined : 17}
                >
                    {reports.map((report) => (
                        <SafeSpotMapMarker key={report.id} report={report} />
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
