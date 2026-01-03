import { lazy, Suspense, useState, useEffect, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
// import { PullToRefresh } from '@/components/ui/PullToRefresh' // Removed for map compatibility
import { reportsApi } from '@/lib/api'
import type { Report } from '@/lib/api'
import { MapLayout } from '@/layouts/MapLayout'
import { useMapStore } from '@/lib/store/useMapStore'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { List } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

// CRITICAL: Lazy load map component to prevent SSR/build-time execution of Leaflet
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
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const initialFocus = location.state as { focusReportId: string, lat: number, lng: number } | null
  const activateZoneType = (location.state as any)?.activateZoneType as any
  const [searchParams] = useSearchParams()
  const setShowSearchAreaButton = useMapStore(s => s.setShowSearchAreaButton)
  const mapBounds = useMapStore(s => s.mapBounds)
  const setSelectedReportId = useMapStore(s => s.setSelectedReportId)

  const [boundsSearchEnabled, setBoundsSearchEnabled] = useState(false)

  // Sync URL -> Store
  useEffect(() => {
    const reportId = searchParams.get('reportId')
    if (reportId) {
      setSelectedReportId(reportId)
    }
  }, [searchParams, setSelectedReportId])

  // MAIN REPORTS QUERY
  const { data: reports = [], isFetching } = useQuery<Report[]>({
    queryKey: ['reports', boundsSearchEnabled ? mapBounds : 'all'],
    queryFn: async () => {
      if (boundsSearchEnabled && mapBounds) {
        const { north, south, east, west } = mapBounds
        return reportsApi.getReportsInBounds(north, south, east, west)
      }
      return reportsApi.getAll()
    },
    staleTime: 30000, // 30 seconds fresh
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  // MERGE STATE REPORT: Ensure the focused report exists in the list even if not fetched yet
  const reportFromState = (location.state as any)?.report as Report | undefined

  const displayReports = useMemo<Report[]>(() => {
    if (reportFromState && !reports.find(r => r.id === reportFromState.id)) {
      return [reportFromState, ...reports]
    }
    return reports
  }, [reports, reportFromState])

  const handleSearchInArea = useCallback(() => {
    if (!mapBounds) return
    setBoundsSearchEnabled(true)
    setShowSearchAreaButton(false)
    queryClient.invalidateQueries({ queryKey: ['reports'] })
  }, [mapBounds, setShowSearchAreaButton, queryClient])

  return (
    <>
      <Helmet>
        <title>Explorar Mapa - SafeSpot</title>
        <meta name="description" content="Explora reportes de seguridad en el mapa interactivo de SafeSpot" />
      </Helmet>

      <MapLayout>
        <Suspense fallback={<MapLoadingFallback />}>
          <SafeSpotMap
            reports={displayReports}
            initialFocus={initialFocus}
            activateZoneType={activateZoneType}
            onSearchArea={handleSearchInArea}
            isSearching={isFetching}
          />
        </Suspense>

        {/* Floating button to go to list view */}
        <div className="absolute bottom-20 left-4 z-[1000] md:bottom-6 md:left-6">
          <Button
            onClick={() => navigate('/reportes')}
            className="bg-dark-card hover:bg-dark-card/90 text-foreground shadow-lg h-12"
          >
            <List className="h-5 w-5 mr-2" />
            Ver Lista
          </Button>
        </div>
      </MapLayout>
    </>
  )
}
