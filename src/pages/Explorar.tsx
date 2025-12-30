import { lazy, Suspense, useState, useEffect, useCallback } from 'react'
import { Helmet } from 'react-helmet-async'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import type { Report } from '@/lib/api'
import { MapLayout } from '@/layouts/MapLayout'
import { useMapStore } from '@/lib/store/useMapStore'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { List, Search } from 'lucide-react'

// CRITICAL: Lazy load map component to prevent SSR/build-time execution of Leaflet
// Leaflet requires window/document and will crash if executed during build
const SafeSpotMap = lazy(() => import('@/components/map/SafeSpotMap').then(m => ({ default: m.SafeSpotMap })))

// Loading fallback for map
const MapLoadingFallback = () => (
  <div className="w-full h-full flex items-center justify-center bg-dark-bg">
    <div className="text-center">
      <div className="animate-spin h-12 w-12 border-4 border-neon-green border-t-transparent rounded-full mx-auto mb-4"></div>
      <p className="text-foreground/60">Cargando mapa...</p>
    </div>
  </div>
)

export function Explorar() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const initialFocus = location.state as { focusReportId: string, lat: number, lng: number } | null
  const [searchParams] = useSearchParams()
  const setShowSearchAreaButton = useMapStore(s => s.setShowSearchAreaButton)
  const mapBounds = useMapStore(s => s.mapBounds)
  const setSelectedReportId = useMapStore(s => s.setSelectedReportId)
  const [reports, setReports] = useState<Report[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Sync URL -> Store
  useEffect(() => {
    const reportId = searchParams.get('reportId')
    if (reportId) {
      setSelectedReportId(reportId)
    }
  }, [searchParams, setSelectedReportId])

  const loadReports = useCallback(async () => {
    try {
      const data = await reportsApi.getAll()
      setReports(data)
    } catch (error) {
      console.error('Error loading reports:', error)
      toast.error('Error al cargar reportes')
    }
  }, [toast])

  useEffect(() => {
    loadReports()
  }, [loadReports])

  const handleSearchInArea = useCallback(async () => {
    if (!mapBounds) return

    setIsSearching(true)
    try {
      const { north, south, east, west } = mapBounds
      const data = await reportsApi.getReportsInBounds(north, south, east, west)
      setReports(data)
      setShowSearchAreaButton(false)
      toast.success(`Se encontraron ${data.length} reportes en esta área`)
    } catch (error) {
      console.error('Error searching in area:', error)
      toast.error('Error al buscar en el área')
    } finally {
      setIsSearching(false)
    }
  }, [mapBounds, setShowSearchAreaButton, toast])

  return (
    <>
      <Helmet>
        <title>Explorar Mapa - SafeSpot</title>
        <meta name="description" content="Explora reportes de seguridad en el mapa interactivo de SafeSpot" />
      </Helmet>

      <MapLayout>
        <Suspense fallback={<MapLoadingFallback />}>
          <SafeSpotMap reports={reports} initialFocus={initialFocus} />
        </Suspense>

        {/* Search in area button */}
        {mapBounds && (
          <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-[1000]">
            <Button
              onClick={handleSearchInArea}
              disabled={isSearching}
              className="bg-neon-green hover:bg-neon-green/90 text-dark-bg shadow-lg"
            >
              <Search className="h-5 w-5 mr-2" />
              {isSearching ? 'Buscando...' : 'Buscar en esta área'}
            </Button>
          </div>
        )}

        {/* Floating button to go to list view */}
        <div className="absolute bottom-6 left-6 z-[1000]">
          <Button
            onClick={() => navigate('/reportes')}
            className="bg-dark-card hover:bg-dark-card/90 text-foreground shadow-lg"
          >
            <List className="h-5 w-5 mr-2" />
            Ver Lista
          </Button>
        </div>
      </MapLayout>
    </>
  )
}
