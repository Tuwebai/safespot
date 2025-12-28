import { useState, useEffect } from 'react'
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

export function Explorar() {
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const initialFocus = location.state as { focusReportId: string, lat: number, lng: number } | null
  const [searchParams] = useSearchParams()
  const setShowSearchAreaButton = useMapStore(s => s.setShowSearchAreaButton)
  const setSelectedReportId = useMapStore(s => s.setSelectedReportId)

  const [reports, setReports] = useState<Report[]>([])

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
      // Error handling via Toast, map remains visible (empty)
      console.error(errorInfo)
    }
  }

  return (
    <MapLayout>
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

      <SafeSpotMap
        reports={reports}
        onSearchArea={() => {
          loadReports()
          setShowSearchAreaButton(false)
        }}
        initialFocus={initialFocus}
      />
    </MapLayout>
  )
}
