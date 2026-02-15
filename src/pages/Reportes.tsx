import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
// Force IDE refresh

// import { generateSEOTags } from '@/lib/seo' // Remove old one if exists or unused
import { SEO } from '@/components/SEO'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useQueryClient } from '@tanstack/react-query'
// reportsApi removed
import { getAnonymousIdSafe } from '@/lib/identity'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'


import { Button } from '@/components/ui/button'
import { Filter } from 'lucide-react'
import type { Report, ReportFilters } from '@/lib/schemas'
import { ReportCardSkeleton } from '@/components/ui/skeletons'

import { BottomSheet } from '@/components/ui/bottom-sheet'

import { useReportsQuery, useFlagReportMutation } from '@/hooks/queries/useReportsQuery'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/queryKeys'

import { searchAddresses, type AddressSuggestion } from '@/services/georefClient'
import { PullToRefresh } from '@/components/ui/PullToRefresh'

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'

import { EmptyState } from '@/components/ui/empty-state'
import { reportsCache } from '@/lib/cache-helpers'

// Nuevos componentes del rediseño
import { QuickFilterType } from '@/components/reportes/QuickFilters'
import { HighlightedReportCard } from '@/components/reportes/HighlightedReportCard'
import { CompactReportCard } from '@/components/reportes/CompactReportCard'
import { ReportsSidebar } from '@/components/reportes/ReportsSidebar'
import { useUserZone } from '@/hooks/useUserZone'
import { useLocationAuthority } from '@/hooks/useLocationAuthority'
import { useMediaQuery } from '@/hooks/useMediaQuery'

// ============================================
// PURE HELPER FUNCTIONS (outside component - no re-creation)
// ============================================

// ... (I will use multi_replace_file_content for this) (Helpers can remain if other components use them, or be removed. I'll leave them to avoid large deletions for now, cleanup later)
// Keep helper functions for now...

// ============================================
// COMPONENT
// ============================================

export function Reportes() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { checkAuth } = useAuthGuard()
  const { mutateAsync: flagReport } = useFlagReportMutation()

  // 🛡️ PRE-AUTH GUARD: Check auth BEFORE navigating to form
  const handleCreateReport = () => {
    if (!checkAuth()) return;
    navigate('/crear-reporte');
  };

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // Advanced Filter State
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'oldest'>('recent')
  const [followedOnly, setFollowedOnly] = useState(false)

  // Address Autocomplete State
  const [addressQuery, setAddressQuery] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number, label: string } | null>(null)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)

  // Quick Filters State (nuevo)
  const [quickFilter, setQuickFilter] = useState<QuickFilterType>('all')

  // Sidebar Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('reports_sidebar_collapsed')
      return saved === 'true'
    }
    return false
  })

  const toggleSidebar = (val: boolean) => {
    setIsSidebarCollapsed(val)
    localStorage.setItem('reports_sidebar_collapsed', String(val))
  }

  const isDesktop = useMediaQuery('(min-width: 1024px)')

  const debouncedAddressQuery = useDebounce(addressQuery, 500)

  // Fetch address suggestions
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (debouncedAddressQuery.length < 3) {
        setAddressSuggestions([])
        return
      }

      // Don't search if the query matches the selected location label (user just selected it)
      if (selectedLocation && debouncedAddressQuery === selectedLocation.label) {
        return
      }

      const results = await searchAddresses(debouncedAddressQuery)
      setAddressSuggestions(results)
    }

    fetchSuggestions()
  }, [debouncedAddressQuery, selectedLocation])

  // Read category from URL params on mount
  useEffect(() => {
    const categoryParam = searchParams.get('category')
    if (categoryParam) {
      setSelectedCategory(categoryParam)
    }
  }, [searchParams])

  // Flag dialog state
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false)
  const [flaggingReportId, setFlaggingReportId] = useState<string | null>(null)
  // Store the active reason to spin ONLY the clicked button
  // Format: "reportId:reason" or separate state. Since dialog is modal for 1 report, just reason is enough.
  const [processingReason, setProcessingReason] = useState<string | null>(null)
  const [flagComment, setFlagComment] = useState('')

  // Keep usage of Set for global "is processing" check if needed, OR simplify.
  // Using Set to prevent multiple flags on different reports is fine, but for the dialog UI we need granularity.
  const [flaggingReports, setFlaggingReports] = useState<Set<string>>(new Set())

  // Debounce search term to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  // Keyboard Shortcuts: '/' to search
  const searchInputRef = useRef<HTMLInputElement>(null)
  useKeyboardShortcuts('/', () => {
    searchInputRef.current?.focus()
  })

  // Interactuar con la zona del usuario (SSOT)
  const { zones, updateCurrentZone } = useUserZone()
  const currentZone = zones?.find(z => z.type === 'current')

  // Estado para guardar el nombre de la ciudad resuelto (Async)
  const [cityName, setCityName] = useState<string | null>(null)

  // Effect: Resolver nombre de ciudad cuando se activa el filtro
  useEffect(() => {
    const resolveCity = async () => {
      if (quickFilter !== 'mi_zona') {
        setCityName(null)
        return
      }

      let lat, lng;
      if (currentZone) {
        lat = currentZone.lat
        lng = currentZone.lng
      } else if (selectedLocation) {
        lat = selectedLocation.lat
        lng = selectedLocation.lng
      }

      if (lat && lng) {
        try {
          // Import dinámico para evitar cargar georefClient si no se usa
          const { reverseGeocode } = await import('@/services/georefClient')
          const result = await reverseGeocode(lat, lng)
          if (result && result.locality) {
            setCityName(result.locality)
          }
        } catch (e) {
          console.error("Error resolving city", e)
        }
      }
    }
    resolveCity()
  }, [quickFilter, currentZone, selectedLocation])

  // Build filters object (memoized to prevent unnecessary query refetches)
  const filters = useMemo<ReportFilters | undefined>(() => {
    const f: ReportFilters = {}

    // Quick Filters Logic (nuevo)
    if (quickFilter === 'urgent') {
      // Reportes de últimas 24h
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      f.startDate = yesterday.toISOString().split('T')[0]
    } else if (quickFilter === 'robos') {
      // Todas las categorías de robo - TODO: Hacer dinámico
      f.category = 'Robo de Bicicleta'
    } else if (quickFilter === 'motos') {
      f.category = 'Motos'
    } else if (quickFilter === 'mi_zona') {
      // ✅ ENTERPRISE LOGIC: "Fijo la Ciudad"
      // Si logramos resolver el nombre de la ciudad, filtramos por ZONA (Texto Exacto)
      if (cityName) {
        f.zone = cityName
        // NO enviamos lat/lng/radius para evitar lógica geo del backend
        // Esto activa el filtro `r.zone ILIKE $cityName`
      } else {
        // Fallback Graceful: Si falla la resolución de nombre, usamos radio amplio (Safety Net)
        if (currentZone) {
          f.lat = currentZone.lat
          f.lng = currentZone.lng
          f.radius = currentZone.radius_meters || 15000
        } else if (selectedLocation) {
          f.lat = selectedLocation.lat
          f.lng = selectedLocation.lng
          f.radius = 15000
        }
      }
    }

    // Filtros avanzados (solo si no están en conflicto con quick filters)
    if (selectedCategory !== 'all' && quickFilter === 'all') f.category = selectedCategory
    if (selectedStatus !== 'all') f.status = selectedStatus
    if (debouncedSearchTerm.trim()) f.search = debouncedSearchTerm.trim()

    // Advanced Filters
    if (startDate && quickFilter !== 'urgent') f.startDate = startDate
    if (endDate) f.endDate = endDate
    if (sortBy !== 'recent') f.sortBy = sortBy

    if (selectedLocation && quickFilter !== 'mi_zona') {
      f.lat = selectedLocation.lat
      f.lng = selectedLocation.lng
      f.radius = 2000 // 2km radius hardcoded for now, could be dynamic
    }

    if (followedOnly) f.followed_only = true

    return Object.keys(f).length > 0 ? f : undefined
  }, [quickFilter, selectedCategory, selectedStatus, debouncedSearchTerm, startDate, endDate, sortBy, selectedLocation, followedOnly, currentZone, cityName])

  // ✅ MOTOR 5: Location Authority Engine
  const { requestLocation, position: enginePosition } = useLocationAuthority()

  // Effect: Auto-trigger location request if 'mi_zona' selected but no zone exists
  useEffect(() => {
    if (quickFilter === 'mi_zona' && !currentZone && !selectedLocation) {
      // Si el usuario toca "Mi Zona" y no tiene zona ni ubicación manual, pedimos GPS
      requestLocation('manual').then(() => {
        // El engine resuelve la ubicación de forma async
        // La integración con updateCurrentZone se hace mediante otro effect
      }).catch((error) => {
        console.error("Error auto-fetching location for Mi Zona", error)
        toast.error("No pudimos obtener tu ubicación. Por favor actívala para ver reportes cercanos.")
      })
    }
  }, [quickFilter, currentZone, selectedLocation, requestLocation, toast])

  // Effect: Sync engine position to current zone
  useEffect(() => {
    if (enginePosition && quickFilter === 'mi_zona' && !currentZone) {
      updateCurrentZone({
        lat: enginePosition.lat,
        lng: enginePosition.lng,
        label: 'Ubicación Actual'
      })
    }
  }, [enginePosition, quickFilter, currentZone, updateCurrentZone])

  // React Query - cached, deduplicated, background refetch
  const { data: reports = [], isLoading, error: queryError, refetch } = useReportsQuery(filters)

  // ============================================
  // HANDLERS (memoized with useCallback)
  // ============================================

  // Error message from query
  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null

  const handleFavoriteUpdate = useCallback((reportId: string, newState: boolean) => {
    // SSOT Update: We patch the canonical report, and ReportCard updates itself.
    reportsCache.patch(queryClient, reportId, { is_favorite: newState })
  }, [queryClient])

  const handleFlag = useCallback((e: React.MouseEvent, reportId: string) => {
    e.preventDefault()
    e.stopPropagation()

    // Retrieve report from SSOT cache
    const report = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))
    if (!report) return

    const currentAnonymousId = getAnonymousIdSafe()

    // No permitir flag si es owner
    if (report.author?.isAuthor || report.author?.id === currentAnonymousId) {
      return
    }

    // No permitir flag si ya está flaggeado
    if (report.is_flagged === true) {
      return
    }

    // No permitir si ya está en proceso de flagging
    if (flaggingReports.has(reportId)) {
      return
    }

    // Abrir modal
    setFlaggingReportId(reportId)
    setProcessingReason(null) // Reset reason
    setFlagComment('') // Reset comment
    setIsFlagDialogOpen(true)
  }, [flaggingReports, queryClient]) // Removed 'reports' dependency

  const handleFlagSubmit = useCallback(async (reason: string) => {
    if (!flaggingReportId) return

    const reportId = flaggingReportId
    const report = queryClient.getQueryData<Report>(queryKeys.reports.detail(reportId))

    if (!report) {
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
      return
    }

    // Validaciones finales
    const currentAnonymousId = getAnonymousIdSafe()
    const isOwner = report.author?.isAuthor || report.author?.id === currentAnonymousId;

    if (isOwner || report.is_flagged === true) {
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
      return
    }

    // Marcar como en proceso
    setFlaggingReports(prev => new Set(prev).add(reportId))
    setProcessingReason(reason)

    try {
      await flagReport({ reportId, reason: reason.trim(), comment: flagComment.trim() || undefined })

      // Cerrar modal
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
      toast.success('Reporte denunciado exitosamente')
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : ''

      if (errorMessage.includes('own report')) {
        toast.warning('No puedes denunciar tu propio reporte')
      } else if (errorMessage.includes('already flagged')) {
        toast.warning('Ya has denunciado este reporte anteriormente')
      } else {
        handleErrorWithMessage(error, 'Error al denunciar el reporte', toast.error, 'Reportes.handleFlagSubmit')
      }
    } finally {
      // Remover de flagging en proceso
      setFlaggingReports(prev => {
        const newSet = new Set(prev)
        newSet.delete(reportId)
        return newSet
      })
      setProcessingReason(null)
    }
  }, [flaggingReportId, toast, queryClient, flagReport, flagComment])




  // Algoritmo de selección de reporte destacado (nuevo)
  const highlightedReport = useMemo(() => {
    if (reports.length === 0) return null
    return reports[0]
  }, [reports])

  const feedReports = useMemo(() => {
    if (!highlightedReport) return reports
    return reports.slice(1) // Excluir el destacado del feed
  }, [reports, highlightedReport])


  return (
    <div className="min-h-screen bg-dark-bg flex">
      <SEO
        title="Reportes Recientes"
        description="Explora los últimos reportes de seguridad en tu zona. Mantente informado sobre incidentes y alertas ciudadanas en tiempo real."
      />

      {/* Desktop Sidebar */}
      {isDesktop && (
        <ReportsSidebar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          sortBy={sortBy}
          setSortBy={setSortBy}
          followedOnly={followedOnly}
          setFollowedOnly={setFollowedOnly}
          startDate={startDate}
          setStartDate={setStartDate}
          endDate={endDate}
          setEndDate={setEndDate}
          quickFilter={quickFilter}
          setQuickFilter={setQuickFilter}
          addressQuery={addressQuery}
          setAddressQuery={setAddressQuery}
          selectedLocation={selectedLocation}
          setSelectedLocation={setSelectedLocation}
          addressSuggestions={addressSuggestions}
          setAddressSuggestions={setAddressSuggestions}
          cityName={cityName}
          searchInputRef={searchInputRef}
          isCollapsed={isSidebarCollapsed}
          setIsCollapsed={toggleSidebar}
        />
      )}

      {/* Mobile Drawer (Sidebar inside BottomSheet as a drawer) */}
      {!isDesktop && (
        <BottomSheet
          isOpen={isFilterSheetOpen}
          onClose={() => setIsFilterSheetOpen(false)}
          title="Filtros y Exploración"
        >
          {/* Note: In mobile, we don't need the specialized Sidebar component logic 
              but we reuse its sub-components or a simplified version for the drawer.
              Actually, the user asked to move EVERYTHING to the sidebar, and for mobile it's a drawer.
              I'll render the sidebar inside the drawer context partially or use the sidebar component without collapse logic.
          */}
          <div className="pb-10">
            <ReportsSidebar
               searchTerm={searchTerm}
               setSearchTerm={setSearchTerm}
               selectedCategory={selectedCategory}
               setSelectedCategory={setSelectedCategory}
               selectedStatus={selectedStatus}
               setSelectedStatus={setSelectedStatus}
               sortBy={sortBy}
               setSortBy={setSortBy}
               followedOnly={followedOnly}
               setFollowedOnly={setFollowedOnly}
               startDate={startDate}
               setStartDate={setStartDate}
               endDate={endDate}
               setEndDate={setEndDate}
               quickFilter={quickFilter}
               setQuickFilter={setQuickFilter}
               addressQuery={addressQuery}
               setAddressQuery={setAddressQuery}
               selectedLocation={selectedLocation}
               setSelectedLocation={setSelectedLocation}
               addressSuggestions={addressSuggestions}
               setAddressSuggestions={setAddressSuggestions}
               cityName={cityName}
               searchInputRef={searchInputRef}
               // No collapse logic in mobile drawer
            />
          </div>
        </BottomSheet>
      )}

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className={`container mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 transition-all duration-300 ${isDesktop ? 'max-w-[1200px]' : ''}`}>
          
          {/* Header Moble / Desktop simplified */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-foreground">
                Feed de Reportes
              </h1>
              <p className="text-sm sm:text-base text-muted-foreground mt-1">
                {reports.length} reportes activos en la comunidad
              </p>
            </div>
            {!isDesktop && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterSheetOpen(true)}
                className="gap-2 border-neon-green/30 text-neon-green bg-neon-green/5"
              >
                <Filter className="h-4 w-4" />
                Filtros
              </Button>
            )}
          </div>

      {/* Listado de Reportes */}
      < PullToRefresh
        onRefresh={async () => {
          // HOTFIX: Don't invalidate reports - violates SSE-only invariant
          // Pull-to-refresh should rely on SSE for updates
          // Only cancel in-flight queries to prevent race conditions
          await queryClient.cancelQueries({ queryKey: queryKeys.reports.all });
        }
        }
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Reportes ({reports.length})
          </h2>
          <Button onClick={handleCreateReport} variant="neon" className="w-full sm:w-auto">
            Crear Nuevo Reporte
          </Button>
        </div>

        {/* Reporte Destacado (Hero) */}
        {highlightedReport && !isLoading && !error && (
          <HighlightedReportCard
            reportId={highlightedReport.id}
            initialData={highlightedReport}
            onToggleFavorite={(newState: boolean) => handleFavoriteUpdate(highlightedReport.id, newState)}
            onFlag={(e: React.MouseEvent) => handleFlag(e, highlightedReport.id)}
            isFlagging={flaggingReports.has(highlightedReport.id)}
          />
        )}

        {/* Separator similar to Footer (Exact Replica) */}
        {highlightedReport && !isLoading && !error && reports.length > 1 && (
          <div className="w-full border-t border-white/5 my-8" />
        )}

        {
          (isLoading && reports.length === 0) ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* ✅ ENTERPRISE FIX: Stable keys for skeletons */}
              {['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5', 'sk-6'].map((key) => (
                <ReportCardSkeleton key={key} />
              ))}
            </div>
          ) : (error && reports.length === 0) ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={() => refetch()} variant="outline">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : reports.length === 0 ? (
            <div className="py-12">
              <EmptyState
                variant={searchTerm || selectedCategory !== 'all' || selectedStatus !== 'all' || quickFilter !== 'all' ? "search" : "default"}
                title={searchTerm ? "No encontramos coincidencias" : "No hay reportes aquí"}
                description={searchTerm || selectedCategory !== 'all' ? "No hay reportes que coincidan con tus filtros. Intenta búsquedas más generales." : "Parece que esta zona está tranquila por ahora. Si ves algo, repórtalo."}
                action={{
                  label: "Limpiar Filtros",
                  onClick: () => {
                    setSearchTerm('')
                    setSelectedCategory('all')
                    setSelectedStatus('all')
                    setSortBy('recent')
                    setStartDate('')
                    setEndDate('')
                    setAddressQuery('')
                    setSelectedLocation(null)
                    setAddressSuggestions([])
                  },
                  variant: "outline"
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col">
              {/* 
                  Refactor Enterprise: Eliminada virtualización ('react-virtual') por problemas críticos de offset absoluto.
                  SSOT Layout: Usamos CSS Grid nativo.
               */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-fr">
                {feedReports.map((report) => (
                  <div key={report.id} className="h-full">
                    <CompactReportCard
                      reportId={report.id}
                      initialData={report}
                      onToggleFavorite={(newState) => handleFavoriteUpdate(report.id, newState)}
                      onFlag={(e) => handleFlag(e, report.id)}
                      isFlagging={flaggingReports.has(report.id)}
                    />
                  </div>
                ))}
              </div>

              {/* Espacio extra para que la barra de navegación móvil no tape nada */}
              <div className="mt-12">
                <div className="h-40 w-full" />
              </div>
            </div>
          )
        }
      </PullToRefresh >

        </div>
      </main>

      {/* Flag Dialog */}
      {isFlagDialogOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center" style={{ zIndex: 100 }} onClick={() => {
          setIsFlagDialogOpen(false)
          setFlaggingReportId(null)
        }}>
          <Card className="w-full max-w-md bg-zinc-900 border-zinc-800" onClick={(e) => e.stopPropagation()}>
            <CardHeader>
              <CardTitle>Reportar Contenido</CardTitle>
              <CardDescription>
                ¿Por qué quieres reportar este contenido?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    Comentario adicional (opcional)
                  </label>
                  <Textarea
                    placeholder="Añadir contexto extra..."
                    value={flagComment}
                    onChange={(e) => setFlagComment(e.target.value)}
                    maxLength={300}
                    className="resize-none bg-black/30 border-zinc-800 focus:border-neon-green/50 min-h-[80px]"
                  />
                  <div className="text-xs text-right text-muted-foreground">
                    {flagComment.length}/300
                  </div>
                </div>
                <div className="space-y-2">
                  {['Spam', 'Contenido Inapropiado', 'Información Falsa', 'Otro'].map((reason) => {
                    const isProcessingThis = processingReason === reason
                    const isAnyProcessing = processingReason !== null

                    return (
                      <Button
                        key={reason}
                        variant="outline"
                        className="w-full justify-start h-11 border-zinc-800 hover:border-neon-green/50 hover:bg-neon-green/5"
                        onClick={() => handleFlagSubmit(reason)}
                        disabled={isAnyProcessing}
                      >
                        {isProcessingThis ? (
                          <>
                            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full mr-2" />
                            Reportando...
                          </>
                        ) : (
                          reason
                        )}
                      </Button>
                    )
                  })}
                  <Button
                    variant="ghost"
                    className="w-full mt-4 text-muted-foreground"
                    onClick={() => {
                      setIsFlagDialogOpen(false)
                      setFlaggingReportId(null)
                    }}
                    disabled={flaggingReports.has(flaggingReportId ?? '')}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
