import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
// Force IDE refresh

// import { generateSEOTags } from '@/lib/seo' // Remove old one if exists or unused
import { SEO } from '@/components/SEO'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ALL_CATEGORIES as categories, STATUS_OPTIONS as statusOptions } from '@/lib/constants'
import { reportsApi } from '@/lib/api'
import { getAnonymousIdSafe } from '@/lib/identity'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'


import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Filter, ChevronDown, ChevronUp, RotateCcw, Calendar, X, Users } from 'lucide-react'
import type { Report, ReportFilters } from '@/lib/api'
import { ReportCardSkeleton } from '@/components/ui/skeletons'

import { BottomSheet } from '@/components/ui/bottom-sheet'

import { useReportsQuery } from '@/hooks/queries'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/queryKeys'

import { searchAddresses, type AddressSuggestion } from '@/services/georefClient'
import { PullToRefresh } from '@/components/ui/PullToRefresh'

import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { useWindowVirtualizer } from '@tanstack/react-virtual'
import { AdBanner } from '@/components/AdBanner'
import { ReportCard } from '@/components/ReportCard'
import { reportsCache } from '@/lib/cache-helpers'

// ============================================
// PURE HELPER FUNCTIONS (outside component - no re-creation)
// ============================================

// ... (Helpers can remain if other components use them, or be removed. I'll leave them to avoid large deletions for now, cleanup later)
// Keep helper functions for now...

// ============================================
// COMPONENT
// ============================================

export function Reportes() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  // Advanced Filter State
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'oldest'>('recent')
  const [followedOnly, setFollowedOnly] = useState(false)

  // Address Autocomplete State
  const [addressQuery, setAddressQuery] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number, label: string } | null>(null)
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false)

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
  const [flaggingReports, setFlaggingReports] = useState<Set<string>>(new Set())

  // Debounce search term to avoid excessive API calls
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  // Keyboard Shortcuts: '/' to search
  const searchInputRef = useRef<HTMLInputElement>(null)
  useKeyboardShortcuts('/', () => {
    searchInputRef.current?.focus()
  })

  // Build filters object (memoized to prevent unnecessary query refetches)
  const filters = useMemo<ReportFilters | undefined>(() => {
    const f: ReportFilters = {}
    if (selectedCategory !== 'all') f.category = selectedCategory
    if (selectedStatus !== 'all') f.status = selectedStatus
    if (debouncedSearchTerm.trim()) f.search = debouncedSearchTerm.trim()

    // Advanced Filters
    if (startDate) f.startDate = startDate
    if (endDate) f.endDate = endDate
    if (sortBy !== 'recent') f.sortBy = sortBy

    if (selectedLocation) {
      f.lat = selectedLocation.lat
      f.lng = selectedLocation.lng
      f.radius = 2000 // 2km radius hardcoded for now, could be dynamic
    }

    if (followedOnly) f.followed_only = true

    return Object.keys(f).length > 0 ? f : undefined
  }, [selectedCategory, selectedStatus, debouncedSearchTerm, startDate, endDate, sortBy, selectedLocation, followedOnly])

  // React Query - cached, deduplicated, background refetch
  const { data: reports = [], isLoading, isFetching, error: queryError, refetch } = useReportsQuery(filters)

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
    if (report.anonymous_id === currentAnonymousId) {
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
    if (report.anonymous_id === currentAnonymousId || report.is_flagged === true) {
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
      return
    }

    // Marcar como en proceso
    setFlaggingReports(prev => new Set(prev).add(reportId))

    // Snapshot can be just the report object if we only revert that
    const previousReport = report

    // Optimistic update: SSOT Patch
    reportsCache.patch(queryClient, reportId, (old) => ({
      is_flagged: true,
      flags_count: (old.flags_count ?? 0) + 1
    }))

    try {
      await reportsApi.flag(reportId, reason.trim())

      // Cerrar modal
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
    } catch (error) {
      // Revertir optimistic update SSOT
      if (previousReport) {
        reportsCache.patch(queryClient, reportId, previousReport)
      }

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
    }
  }, [flaggingReportId, toast, queryClient])




  const parentRef = useRef<HTMLDivElement>(null)

  const [columns, setColumns] = useState(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1)
  const [scrollMargin, setScrollMargin] = useState(0)

  useEffect(() => {
    const handleLayoutUpdate = () => {
      setColumns(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1)
      if (parentRef.current) {
        // Usar scrollMargin=0 ya que el contenedor está al inicio de la página o manejado por el flujo natural
        setScrollMargin(parentRef.current.offsetTop)
      }
    }

    // Calcular inicial
    handleLayoutUpdate()

    // Observar cambios de tamaño
    window.addEventListener('resize', handleLayoutUpdate)

    // Pequeño delay para asegurar que el DOM se ha asentado tras renderizados (especialmente filtros)
    const timeout = setTimeout(handleLayoutUpdate, 100)

    return () => {
      window.removeEventListener('resize', handleLayoutUpdate)
      clearTimeout(timeout)
    }
  }, [showAdvancedFilters, reports.length])

  // Virtualizer setup using window scroll
  const rowVirtualizer = useWindowVirtualizer({
    count: Math.ceil(reports.length / columns),
    estimateSize: () => 480, // Ajustado para incluir padding y gap
    overscan: 5,
    scrollMargin,
  })


  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <SEO
        title="Reportes Recientes"
        description="Explora los últimos reportes de seguridad en tu zona. Mantente informado sobre incidentes y alertas ciudadanas en tiempo real."
      />
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 text-foreground">
          Lista de Reportes
        </h1>
        <p className="text-muted-foreground">
          Explora y filtra todos los reportes de la comunidad
        </p>
      </div>

      {/* Filtros - Hidden on mobile, shown in bottom sheet */}
      <Card className="mb-8 bg-card border-border hidden md:block">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-neon-green" aria-hidden="true" />
              <h2 className="text-xl font-semibold">Filtros</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="mt-1 flex items-center gap-2 hover:bg-neon-green/10 hover:text-neon-green"
              aria-expanded={showAdvancedFilters}
              aria-label={showAdvancedFilters ? "Ocultar filtros avanzados" : "Mostrar filtros avanzados"}
            >
              {showAdvancedFilters ? (
                <>Ocultar Filtros <ChevronUp className="h-4 w-4" aria-hidden="true" /></>
              ) : (
                <>Filtros Avanzados <ChevronDown className="h-4 w-4" aria-hidden="true" /></>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Filtros Básicos (Siempre visibles) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Búsqueda Global */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                ref={searchInputRef}
                placeholder="Buscar por título, desc... (Presiona /)"
                aria-label="Buscar reportes por título o descripción"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
                inputMode="search"
                autoComplete="off"
              />
            </div>

            {/* Categoría */}
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>

            {/* Estado */}
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </Select>

            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="recent">Más Recientes</option>
              <option value="popular">Más Populares</option>
              <option value="oldest">Más Antiguos</option>
            </Select>

            {/* Círculo de Confianza (Followed Only) */}
            <div className="flex items-center justify-between px-3 py-1.5 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors cursor-pointer group"
              onClick={() => setFollowedOnly(!followedOnly)}
            >
              <div className="flex items-center gap-2">
                <Users className={`h-4 w-4 transition-colors ${followedOnly ? 'text-neon-green' : 'text-muted-foreground group-hover:text-foreground'}`} />
                <span className={`text-sm font-medium transition-colors ${followedOnly ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>
                  Mi Círculo
                </span>
              </div>
              <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${followedOnly ? 'bg-neon-green/30' : 'bg-muted'}`}>
                <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${followedOnly ? 'right-0.5 bg-neon-green shadow-[0_0_8px_rgba(33,255,140,0.5)]' : 'left-0.5 bg-muted-foreground'}`} />
              </div>
            </div>
          </div>

          {/* Filtros Avanzados (Colapsables) */}
          {showAdvancedFilters && (
            <div className="pt-4 border-t border-dark-border/50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Buscador de Dirección / Lugar */}
                <div className="relative z-20">
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Ubicación
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    <Input
                      placeholder="Buscar dirección..."
                      aria-label="Buscar por dirección o lugar"
                      value={addressQuery}
                      onChange={(e) => {
                        setAddressQuery(e.target.value)
                        if (selectedLocation && e.target.value !== selectedLocation.label) {
                          setSelectedLocation(null) // Reset location filter if user types
                        }
                      }}
                      className={`pl-10 ${selectedLocation ? 'ring-1 ring-neon-green/50 border-neon-green/50' : ''}`}
                      inputMode="search"
                      autoComplete="address-line1"
                    />
                    {selectedLocation && (
                      <button
                        onClick={() => {
                          setSelectedLocation(null)
                          setAddressQuery('')
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/10 rounded-full"
                        aria-label="Limpiar selección de ubicación"
                      >
                        <X className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Suggestions Dropdown */}
                  {addressSuggestions.length > 0 && !selectedLocation && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-dark-card border border-dark-border rounded-md shadow-xl z-50 max-h-60 overflow-y-auto">
                      {addressSuggestions.map((suggestion, idx) => (
                        <button
                          key={`${suggestion.normalized}-${idx}`}
                          className="w-full text-left px-4 py-2 hover:bg-white/5 text-sm flex flex-col transition-colors border-b border-white/5 last:border-0"
                          onClick={() => {
                            setSelectedLocation({
                              lat: suggestion.location.lat,
                              lng: suggestion.location.lng,
                              label: suggestion.original
                            })
                            setAddressQuery(suggestion.original)
                            setAddressSuggestions([])
                          }}
                        >
                          <span className="font-medium text-foreground">{suggestion.original}</span>
                          <span className="text-xs text-muted-foreground">{suggestion.locality}, {suggestion.province}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedLocation && (
                    <p className="text-xs text-neon-green mt-1 flex items-center">
                      <MapPin className="h-3 w-3 mr-1" />
                      Filtrando a 2km de esta ubicación
                    </p>
                  )}
                </div>

                {/* Fechas */}
                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Fecha Desde
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="pl-10 [color-scheme:dark]"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                    Fecha Hasta
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="pl-10 [color-scheme:dark]"
                    />
                  </div>
                </div>
              </div>

              {/* Acciones de filtro */}
              <div className="flex justify-end mt-4 pt-4 border-t border-dark-border/30">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    setSearchTerm('')
                    setSelectedCategory('all')
                    setSelectedStatus('all')
                    setSortBy('recent')
                    setStartDate('')
                    setEndDate('')
                    setAddressQuery('')
                    setSelectedLocation(null)
                  }}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Limpiar Filtros
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile Filter Button - Floating */}
      <Button
        onClick={() => setIsFilterSheetOpen(true)}
        className="md:hidden fixed bottom-20 right-4 z-50 h-14 w-14 rounded-full shadow-2xl bg-neon-green hover:bg-neon-green/90 text-dark-bg"
        size="icon"
      >
        <Filter className="h-6 w-6" />
      </Button>

      {/* Mobile Bottom Sheet for Filters */}
      <BottomSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filtros"
      >
        {/* Same filter content as desktop */}
        <div className="space-y-6">
          {/* Búsqueda Global */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título, desc..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
              inputMode="search"
              autoComplete="off"
            />
          </div>

          {/* Categoría */}
          <div>
            <label className="text-sm font-medium mb-2 block">Categoría</label>
            <Select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="all">Todas las categorías</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </div>

          {/* Estado */}
          <div>
            <label className="text-sm font-medium mb-2 block">Estado</label>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="all">Todos los estados</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </Select>
          </div>

          {/* Ordenar Por */}
          <div>
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="recent">Más Recientes</option>
              <option value="popular">Más Populares</option>
              <option value="oldest">Más Antiguos</option>
            </Select>
          </div>

          {/* Mi Círculo Mobile */}
          <div
            className={`flex items-center justify-between p-4 rounded-xl border transition-all ${followedOnly ? 'bg-neon-green/5 border-neon-green/30 shadow-[0_0_15px_rgba(33,255,140,0.05)]' : 'bg-zinc-900/50 border-zinc-800'}`}
            onClick={() => setFollowedOnly(!followedOnly)}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${followedOnly ? 'bg-neon-green text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className={`font-bold transition-colors ${followedOnly ? 'text-white' : 'text-zinc-400'}`}>Mi Círculo</div>
                <div className="text-xs text-zinc-600">Solo reportes de gente que sigues</div>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full relative transition-colors duration-300 ${followedOnly ? 'bg-neon-green/30' : 'bg-zinc-800'}`}>
              <div className={`absolute top-1 w-4 h-4 rounded-full transition-all duration-300 ${followedOnly ? 'right-1 bg-neon-green' : 'left-1 bg-zinc-600'}`} />
            </div>
          </div>

          {/* Reset Button */}
          <Button
            variant="outline"
            onClick={() => {
              setSearchTerm('')
              setSelectedCategory('all')
              setSelectedStatus('all')
              setSortBy('recent')
              setStartDate('')
              setEndDate('')
              setSelectedLocation(null)
              setAddressQuery('')
            }}
            className="w-full"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Limpiar Filtros
          </Button>

          {/* Apply Button */}
          <Button
            onClick={() => setIsFilterSheetOpen(false)}
            className="w-full bg-neon-green hover:bg-neon-green/90 text-dark-bg"
          >
            Aplicar Filtros
          </Button>
        </div>
      </BottomSheet >

      {/* Listado de Reportes */}
      < PullToRefresh
        onRefresh={async () => {
          await queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
        }
        }
        className="mb-8"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pt-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-foreground">
            Reportes {isFetching ? '...' : `(${reports.length})`}
          </h2>
          <Link to="/crear-reporte" className="w-full sm:w-auto">
            <Button variant="neon" className="w-full">
              Crear Nuevo Reporte
            </Button>
          </Link>
        </div>

        {
          isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <ReportCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <p className="text-destructive mb-4">{error}</p>
                <Button onClick={() => refetch()} variant="outline">
                  Reintentar
                </Button>
              </CardContent>
            </Card>
          ) : reports.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  No se encontraron reportes con los filtros seleccionados.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col">
              <div
                ref={parentRef}
                className="w-full relative"
                style={{ minHeight: '600px' }}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    // reports is now string[] (IDs)
                    const startIndex = virtualRow.index * columns
                    const rowItems = reports.slice(startIndex, startIndex + columns)

                    return (
                      <div
                        key={virtualRow.key}
                        data-index={virtualRow.index}
                        ref={(el) => {
                          if (el) {
                            rowVirtualizer.measureElement(el)
                          }
                        }}
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8"
                      >
                        {rowItems.map((reportId: string) => (
                          <ReportCard
                            key={reportId}
                            reportId={reportId}
                            onToggleFavorite={(newState) => handleFavoriteUpdate(reportId, newState)}
                            onFlag={(e) => handleFlag(e, reportId)}
                            isFlagging={flaggingReports.has(reportId)}
                          />
                        ))}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Publicidad y Espaciador Final */}
              <div className="mt-12 space-y-8">
                {reports.length > 0 && (
                  <div className="border-t border-border/30 pt-12">
                    <AdBanner />
                  </div>
                )}
                {/* Espacio extra para que la barra de navegación móvil no tape nada */}
                <div className="h-40 w-full" />
              </div>
            </div>
          )
        }
      </PullToRefresh >

      {/* Flag Dialog */}
      {
        isFlagDialogOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => {
            setIsFlagDialogOpen(false)
            setFlaggingReportId(null)
          }}>
            <Card className="w-full max-w-md bg-dark-card border-dark-border" onClick={(e) => e.stopPropagation()}>
              <CardHeader>
                <CardTitle>Reportar Contenido</CardTitle>
                <CardDescription>
                  ¿Por qué quieres reportar este contenido?
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {['Spam', 'Contenido Inapropiado', 'Información Falsa', 'Otro'].map((reason) => {
                    const isFlagging = flaggingReports.has(flaggingReportId ?? '')
                    return (
                      <Button
                        key={reason}
                        variant="outline"
                        className="w-full justify-start"
                        onClick={() => handleFlagSubmit(reason)}
                        disabled={isFlagging}
                      >
                        {isFlagging ? (
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
                    className="w-full mt-4"
                    onClick={() => {
                      setIsFlagDialogOpen(false)
                      setFlaggingReportId(null)
                    }}
                    disabled={flaggingReports.has(flaggingReportId ?? '')}
                  >
                    Cancelar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )
      }
    </div >
  )
}
