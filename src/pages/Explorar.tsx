import { useState, useEffect } from 'react'
import { Helmet } from 'react-helmet-async'
import { reportsApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { handleError } from '@/lib/errorHandler'
import type { Report } from '@/lib/api'
import { SafeSpotMap } from '@/components/map/SafeSpotMap'
import { MapLayout } from '@/layouts/MapLayout'
import { useMapStore } from '@/lib/store/useMapStore'
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { List } from 'lucide-react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

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

  // Initial Load
  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      const data = await reportsApi.getAll()
      setReports(data)
    } catch (error) {
      const errorInfo = handleError(error, toast.error, 'Explorar.loadReports')
      console.error(errorInfo)
    }
  }

  const handleSearchArea = async () => {
    if (!mapBounds) {
      loadReports()
      setShowSearchAreaButton(false)
      return
    }

    try {
      setIsSearching(true)
      const data = await reportsApi.getReportsInBounds(
        mapBounds.north,
        mapBounds.south,
        mapBounds.east,
        mapBounds.west
      )
      setReports(data)
      setShowSearchAreaButton(false)
      toast.success(`Zona actualizada: ${data.length} reportes encontrados`)
    } catch (error) {
      handleError(error, toast.error, 'Explorar.bounds')
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <MapLayout>
      <Helmet>
        <title>Explorar Reportes – SafeSpot</title>
        <meta name="description" content="Explora el mapa interactivo de reportes de seguridad en tu ciudad. Mantente informado sobre las zonas de riesgo." />
        <meta property="og:title" content="Explorar Reportes – SafeSpot" />
        <meta property="og:description" content="Explora el mapa interactivo de reportes de seguridad en tu ciudad. Mantente informado sobre las zonas de riesgo." />
      </Helmet>
      {/* Navigation Controls Overlay */}
      <div className="absolute top-4 left-4 z-[500] flex gap-2">
        <Button
          onClick={() => navigate('/reportes')}
          variant="secondary"
          className="shadow-lg bg-white/90 backdrop-blur hover:bg-white text-dark-bg border border-gray-200"
        >
          <List className="h-4 w-4 mr-2" />
          Ver Lista
        </Button>
      </div>

      <ErrorBoundary fallbackTitle="Error al cargar el mapa" onReset={() => loadReports()}>
        <SafeSpotMap
          reports={reports}
          onSearchArea={handleSearchArea}
          initialFocus={initialFocus}
          isSearching={isSearching}
        />
      </ErrorBoundary>
    </MapLayout>
  )
}
