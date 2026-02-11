import { lazy, Suspense, useEffect, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import type { Report } from '@/lib/schemas'
import { MapLayout } from '@/layouts/MapLayout'
import { useMapStore } from '@/lib/store/useMapStore'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { List } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useMapReportsQuery } from '@/hooks/queries/useMapReportsQuery'
import { EmptyState } from '@/components/ui/empty-state'
import { reportsCache } from '@/lib/cache-helpers'
import { initializeLeafletIcons } from '@/lib/leaflet-setup'

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
  const setSelectedReportId = useMapStore(s => s.setSelectedReportId)

  // ✅ FIX: Use searchBounds (normalized) instead of mapBounds (raw)
  const searchBounds = useMapStore(s => s.searchBounds)
  const triggerSearchInBounds = useMapStore(s => s.triggerSearchInBounds)

  // ✅ PERFORMANCE FIX: Initialize Leaflet icons only when map component loads
  useEffect(() => {
    initializeLeafletIcons()
  }, [])

  // Sync URL -> Store
  useEffect(() => {
    const reportId = searchParams.get('reportId')
    if (reportId) {
      setSelectedReportId(reportId)
    }
  }, [searchParams, setSelectedReportId])

  // ✅ FIX: Parse normalized bounds for API call
  const parsedBounds = useMemo(() => {
    if (!searchBounds) return null
    const [north, south, east, west] = searchBounds.split(',').map(Number)
    return { north, south, east, west }
  }, [searchBounds])

  // MAIN REPORTS QUERY - Returns IDs (Enterprise Normalization)
  // ✅ FIX: queryKey uses normalized searchBounds (stable) instead of raw mapBounds
  const { data: reportIds = [], isFetching } = useMapReportsQuery({
    bounds: parsedBounds,
    searchBoundsKey: searchBounds,
  })

  // MERGE STATE REPORT: Ensure the focused report exists in the list even if not fetched yet
  const reportFromState = (location.state as any)?.report as Report | undefined

  const displayReportIds = useMemo<string[]>(() => {
    if (reportFromState && !reportIds.includes(reportFromState.id)) {
      // Store the report from state in cache
      reportsCache.store(queryClient, [reportFromState])
      return [reportFromState.id, ...reportIds]
    }
    return reportIds
  }, [reportIds, reportFromState, queryClient])

  // ✅ FIX: Handler now uses store action with built-in idempotence & telemetry
  const handleSearchInArea = useCallback(() => {
    const result = triggerSearchInBounds()
    if (result.triggered) {
      // Query will automatically refetch due to queryKey change
    }
    // If not triggered (idempotent skip), nothing happens - by design
  }, [triggerSearchInBounds])

  return (
    <>
      <Helmet>
        <title>Explorar Mapa - SafeSpot</title>
        <meta name="description" content="Explora reportes de seguridad en el mapa interactivo de SafeSpot" />
      </Helmet>

      <MapLayout>
        <Suspense fallback={<MapLoadingFallback />}>
          <SafeSpotMap
            reportIds={displayReportIds}
            initialFocus={initialFocus}
            activateZoneType={activateZoneType}
            onSearchArea={handleSearchInArea}
            // ENTERPRISE FIX: loading = cold start only. Background fetches are silent.
            isSearching={isFetching && reportIds.length === 0}
          />
        </Suspense>

        {/* Floating button to go to list view */}
        <div className="absolute bottom-20 left-4 z-[1000] md:bottom-6 md:left-6">
          <Button
            onClick={() => navigate('/reportes')}
            className="bg-black hover:bg-gray-900 text-white shadow-2xl h-12 border-2 border-neon-green font-semibold"
          >
            <List className="h-5 w-5 mr-2" />
            Ver Lista
          </Button>
        </div>

        {/* Empty State Overlay */}
        {!isFetching && reportIds.length === 0 && (
          <div className="absolute top-24 left-1/2 transform -translate-x-1/2 z-[1000] w-full max-w-md px-4 pointer-events-none">
            <div className="pointer-events-auto shadow-2xl rounded-xl overflow-hidden">
              <EmptyState
                variant="map"
                title="No hay reportes visibles"
                description={searchBounds ? "No encontramos reportes en esta área específica del mapa." : "Actualmente no hay reportes cargados en el sistema."}
                action={{
                  label: "Ver Lista Completa",
                  onClick: () => navigate('/reportes'),
                  variant: "secondary"
                }}
                className="bg-background/90 backdrop-blur-md border border-border py-6"
              />
            </div>
          </div>
        )}
      </MapLayout>
    </>
  )
}
