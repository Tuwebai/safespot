import { divIcon } from 'leaflet'
import { useState, useEffect, useCallback, useRef, useMemo, Fragment } from 'react'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents, ZoomControl, Circle } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import { Button } from '@/components/ui/button'
import { getMarkerIcon } from '@/lib/map-utils'
import type { Report, ZoneType } from '@/lib/api'
import { notificationsApi } from '@/lib/api'
import { Navigation, Calendar, Search, ShieldAlert, Home, Briefcase, MapPin, X, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useMapStore } from '@/lib/store/useMapStore'
import { useUserZones } from '@/hooks/useUserZones'
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'

// Add custom style for placement mode cursor
// Extracted CenterManager to prevent re-mounting loops
const CenterManager = ({
    activeZoneType,
    hasCenteredRef,
    setIsMapReady,
    handleInitialCentering
}: {
    activeZoneType: ZoneType | null,
    hasCenteredRef: React.MutableRefObject<boolean>,
    setIsMapReady: (ready: boolean) => void,
    handleInitialCentering: (map: any) => void
}) => {
    const map = useMap()

    // Initial centering
    useEffect(() => {
        if (map && !hasCenteredRef.current) {
            setIsMapReady(true)
            handleInitialCentering(map)
        }
    }, [map, hasCenteredRef, setIsMapReady, handleInitialCentering])

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

// CRITICAL: Leaflet initialization flag
// This MUST be at module level to persist across component re-renders
let leafletIconsInitialized = false

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
                const color = zoneStyles[zone.type].color
                const pinIcon = createPinIcon(color)

                return (
                    <Fragment key={zone.id}>
                        {/* Zone Radius */}
                        <Circle
                            center={[zone.lat, zone.lng]}
                            radius={zone.radius_meters}
                            pathOptions={{
                                ...zoneStyles[zone.type],
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
        <div className="absolute top-20 left-4 z-[1000] flex flex-col gap-2">
            <div className="bg-dark-card/95 backdrop-blur-md p-3 rounded-2xl border border-neon-green/20 shadow-[0_0_30px_rgba(0,0,0,0.4)] flex flex-col gap-3 min-w-[200px]">
                <div className="flex items-center justify-between gap-4 px-1">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-neon-green/10 rounded-lg">
                            <ShieldAlert className="w-4 h-4 text-neon-green" />
                        </div>
                        <span className="font-bold text-xs text-foreground tracking-tight">MODO ALERTA</span>
                    </div>
                    {activeType && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-foreground/40 hover:text-foreground hover:bg-white/5"
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
                        className={`justify-start gap-3 h-10 px-3 rounded-xl transition-all duration-200 ${activeType === 'home' ? 'bg-emerald-500 hover:bg-emerald-600 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'hover:bg-emerald-500/10 text-foreground/70 hover:text-emerald-500'}`}
                        onClick={() => setActiveType(activeType === 'home' ? null : 'home')}
                    >
                        <Home className="w-4 h-4" />
                        <span className="text-xs font-semibold">Casa</span>
                    </Button>
                    <Button
                        variant={activeType === 'work' ? 'default' : 'ghost'}
                        size="sm"
                        className={`justify-start gap-3 h-10 px-3 rounded-xl transition-all duration-200 ${activeType === 'work' ? 'bg-blue-500 hover:bg-blue-600 shadow-[0_0_15px_rgba(59,130,246,0.3)]' : 'hover:bg-blue-500/10 text-foreground/70 hover:text-blue-500'}`}
                        onClick={() => setActiveType(activeType === 'work' ? null : 'work')}
                    >
                        <Briefcase className="w-4 h-4" />
                        <span className="text-xs font-semibold">Trabajo</span>
                    </Button>
                    <Button
                        variant={activeType === 'frequent' ? 'default' : 'ghost'}
                        size="sm"
                        className={`justify-start gap-3 h-10 px-3 rounded-xl transition-all duration-200 ${activeType === 'frequent' ? 'bg-amber-500 hover:bg-amber-600 shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'hover:bg-amber-500/10 text-foreground/70 hover:text-amber-500'}`}
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
    initialFocus?: { lat: number, lng: number } | null
    isSearching?: boolean
    activateZoneType?: ZoneType | null
}

export function SafeSpotMapClient({
    reports,
    className,
    onSearchArea,
    initialFocus,
    isSearching,
    activateZoneType: externalActivateZoneType
}: SafeSpotMapProps) {
    const [activeZoneType, setActiveZoneType] = useState<ZoneType | null>(null)
    const { zones, saveZone } = useUserZones()
    const hasCenteredRef = useRef(false)
    const [isMapReady, setIsMapReady] = useState(false)

    // Sync external activation from props (e.g. from Profile)
    useEffect(() => {
        if (externalActivateZoneType) {
            setActiveZoneType(externalActivateZoneType)
        }
    }, [externalActivateZoneType])

    // PRIORITY CENTERING LOGIC - DETERMINISTIC ONCE
    const handleInitialCentering = useCallback(async (map: any) => {
        // Guard 0: Already centered or map not ready
        if (hasCenteredRef.current || !isMapReady) return

        // 1. Zoom to initialFocus (deep link) - Only if coordinates are valid numbers
        if (initialFocus && typeof initialFocus.lat === 'number' && typeof initialFocus.lng === 'number' && !isNaN(initialFocus.lat) && !isNaN(initialFocus.lng)) {
            map.setView([initialFocus.lat, initialFocus.lng], 16)
            hasCenteredRef.current = true
            return
        }

        // 2. Priority Zones: Home > Work > Frequent
        const home = zones.find(z => z.type === 'home')
        const work = zones.find(z => z.type === 'work')
        const frequent = zones.find(z => z.type === 'frequent')
        const priorityZone = home || work || frequent

        if (priorityZone && typeof priorityZone.lat === 'number' && typeof priorityZone.lng === 'number' && !isNaN(priorityZone.lat) && !isNaN(priorityZone.lng)) {
            map.setView([priorityZone.lat, priorityZone.lng], 14)
            hasCenteredRef.current = true
            return
        }

        // 3. Last Known Location from Settings
        try {
            const settings = await notificationsApi.getSettings()
            if (settings && typeof settings.last_known_lat === 'number' && typeof settings.last_known_lng === 'number' && !isNaN(settings.last_known_lat) && !isNaN(settings.last_known_lng)) {
                map.setView([settings.last_known_lat, settings.last_known_lng], 13)
                hasCenteredRef.current = true
                return
            }
        } catch (e) {
            // Only log errors, not flow
            console.error('[Map] Settings fetch failed', e)
        }

        // 4. Browser Geolocation
        if ('geolocation' in navigator) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    if (pos.coords.latitude && pos.coords.longitude && map) {
                        map.setView([pos.coords.latitude, pos.coords.longitude], 13)
                        hasCenteredRef.current = true
                    }
                },
                () => {
                    // 5. Fallback: Buenos Aires
                    if (map) {
                        map.setView([-34.6037, -58.3816], 12)
                        hasCenteredRef.current = true
                    }
                },
                { timeout: 5000 }
            )
        } else {
            if (map) {
                map.setView([-34.6037, -58.3816], 12)
                hasCenteredRef.current = true
            }
        }
    }, [isMapReady, zones, initialFocus, activeZoneType])

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

    // CRITICAL: Initialize Leaflet icons ONLY in browser
    useEffect(() => {
        if (leafletIconsInitialized || typeof window === 'undefined') return
        import('leaflet').then((L) => {
            // @ts-expect-error - Leaflet icon internals
            delete L.default.Icon.Default.prototype._getIconUrl
            L.default.Icon.Default.mergeOptions({
                iconRetinaUrl: null,
                iconUrl: null,
                shadowUrl: null,
            })
            leafletIconsInitialized = true
        }).catch(err => console.error('Leaflet icons failed', err))
    }, [])

    // Memoize the transformation of data to prevent redundant calculations on every render
    const validReports = useMemo(() => {
        return reports
            .map(r => ({
                ...r,
                latitude: Number(r.latitude),
                longitude: Number(r.longitude)
            }))
            .filter(r =>
                !isNaN(r.latitude) &&
                !isNaN(r.longitude) &&
                r.latitude !== 0
            )
    }, [reports])

    const highlightedId = useMapStore(s => s.highlightedReportId)
    const showSearchButton = useMapStore(s => s.showSearchAreaButton)

    // Compute initial center synchronously to avoid visual jump
    const defaultCenter = useMemo((): [number, number] => {
        // 1. Initial Focus (Deep Link)
        if (initialFocus && typeof initialFocus.lat === 'number' && typeof initialFocus.lng === 'number' && !isNaN(initialFocus.lat) && !isNaN(initialFocus.lng)) {
            return [initialFocus.lat, initialFocus.lng]
        }

        // 2. Priority Zones (Home > Work > Frequent)
        // Since we have staleTime on useQuery, these should be available immediately from cache
        const home = zones.find(z => z.type === 'home')
        const work = zones.find(z => z.type === 'work')
        const frequent = zones.find(z => z.type === 'frequent')
        const priorityZone = home || work || frequent

        if (priorityZone && typeof priorityZone.lat === 'number' && typeof priorityZone.lng === 'number') {
            return [priorityZone.lat, priorityZone.lng]
        }

        // 3. Fallback
        return [-34.6037, -58.3816]
    }, [initialFocus, zones])

    return (
        <div
            className={`relative w-full h-full min-h-[500px] bg-dark-bg z-0 ${className} ${activeZoneType ? 'map-placement-mode' : ''}`}
        >
            {/* Zone Management UI */}
            <AlertZoneControl activeType={activeZoneType} setActiveType={setActiveZoneType} />

            {/* Persistent Zone Status Overlay - FIXED POSITION, INDEPENDENT OF MAP */}
            <div className="absolute bottom-6 left-4 z-[500] pointer-events-none">
                <div className="bg-dark-card/95 backdrop-blur-md p-3 rounded-xl border border-neon-green/10 shadow-[0_0_20px_rgba(0,0,0,0.5)] pointer-events-auto min-w-[160px]">
                    <p className="text-[10px] uppercase tracking-widest text-neon-green/60 font-black mb-2 px-1">Zonas Configuradas</p>
                    <div className="flex flex-col gap-2">
                        {['home', 'work', 'frequent'].map(type => {
                            const zone = zones.find(z => z.type === type)
                            return (
                                <div key={type} className="flex items-center justify-between gap-4 text-xs p-2 rounded-lg bg-white/5 border border-white/5">
                                    <div className="flex items-center gap-2">
                                        <div className={`p-1.5 rounded-md ${zone ? (
                                            type === 'home' ? 'bg-emerald-500/20 text-emerald-500' :
                                                type === 'work' ? 'bg-blue-500/20 text-blue-500' :
                                                    'bg-amber-500/20 text-amber-500'
                                        ) : 'bg-white/5 text-muted-foreground'}`}>
                                            {type === 'home' && <Home className="w-3 h-3" />}
                                            {type === 'work' && <Briefcase className="w-3 h-3" />}
                                            {type === 'frequent' && <MapPin className="w-3 h-3" />}
                                        </div>
                                        <span className={`font-medium ${zone ? 'text-foreground' : 'text-muted-foreground'}`}>
                                            {type === 'home' ? 'Casa' : type === 'work' ? 'Trabajo' : 'Zona Frec.'}
                                        </span>
                                    </div>
                                    <div className={`w-2 h-2 rounded-full ${zone ? 'bg-neon-green animate-pulse shadow-[0_0_8px_#39FF14]' : 'bg-white/10'}`} />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            <MapContainer
                center={defaultCenter}
                zoom={12}
                scrollWheelZoom={true}
                dragging={true}
                doubleClickZoom={true}
                zoomControl={false}
                className={`w-full h-full ${activeZoneType ? 'map-placement-mode' : ''}`}
            >
                <CenterManager
                    activeZoneType={activeZoneType}
                    hasCenteredRef={hasCenteredRef}
                    setIsMapReady={setIsMapReady}
                    handleInitialCentering={handleInitialCentering}
                />
                <ZoomControl position="bottomright" />
                <MapEvents />
                <MapClickListener activeType={activeZoneType} onPlace={handlePlaceZone} />
                <MouseTracker activeType={activeZoneType} isSaving={isSavingZone} />
                <MapSync reports={reports} />
                <ZoneMarkers />

                <TileLayer
                    attribution='&copy; CARTO'
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png"
                />

                <MarkerClusterGroup chunkedLoading maxClusterRadius={60}>
                    {validReports.map((report) => (
                        <Marker
                            key={report.id}
                            position={[report.latitude, report.longitude]}
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
                                        {report.priority_zone && (
                                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${report.priority_zone === 'home' ? 'bg-emerald-500' :
                                                report.priority_zone === 'work' ? 'bg-blue-500' : 'bg-amber-500'
                                                } text-white`}>
                                                En tu {report.priority_zone === 'home' ? 'Casa' : report.priority_zone === 'work' ? 'Trabajo' : 'Zona'}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="font-bold text-sm mb-1 line-clamp-2">{report.title}</h4>
                                    <div className="flex items-center text-xs text-muted-foreground mb-3">
                                        <Calendar className="h-3 w-3 mr-1" />
                                        {new Date(report.created_at).toLocaleDateString()}
                                    </div>
                                    <Link to={`/reporte/${report.id}`}>
                                        <Button size="sm" variant="neon" className="w-full h-8 text-xs">Ver Detalles</Button>
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
