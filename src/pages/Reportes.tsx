import { useState, useCallback, useMemo, useEffect } from 'react'
// Force IDE refresh
import { Helmet } from 'react-helmet-async'
import { generateSEOTags } from '@/lib/seo'
import { Link, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ALL_CATEGORIES as categories, STATUS_OPTIONS as statusOptions } from '@/lib/constants'
import { reportsApi } from '@/lib/api'
import { getAnonymousIdSafe } from '@/lib/identity'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Filter, GitBranch, MessageCircle, Flag, Home, Briefcase, ChevronDown, ChevronUp, RotateCcw, Calendar, X } from 'lucide-react'
import type { Report, ReportFilters } from '@/lib/api'
import { ReportCardSkeleton } from '@/components/ui/skeletons'
import { AnimatedCard } from '@/components/ui/animated'
import { OptimizedImage } from '@/components/OptimizedImage'
import { FavoriteButton } from '@/components/FavoriteButton'
import { SmartLink } from '@/components/SmartLink'
import { useReportsQuery } from '@/hooks/queries'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/queryKeys'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { searchAddresses, type AddressSuggestion } from '@/services/georefClient'

// ============================================
// PURE HELPER FUNCTIONS (outside component - no re-creation)
// ============================================

const getStatusColor = (status: Report['status']) => {
  switch (status) {
    case 'pendiente':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    case 'en_proceso':
      return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'resuelto':
      return 'bg-green-500/20 text-green-400 border-green-500/30'
    case 'cerrado':
      return 'bg-red-500/20 text-red-400 border-red-500/30'
    default:
      return ''
  }
}

const STATUS_LABELS: Record<Report['status'], string> = {
  'pendiente': 'Buscando',
  'en_proceso': 'En Proceso',
  'resuelto': 'Recuperado',
  'cerrado': 'Expirado'
}

const getStatusLabel = (status: Report['status']) => STATUS_LABELS[status] || status

const CATEGORY_COLORS: Record<string, string> = {
  'Robo de Bicicleta': 'bg-red-500',
  'Robo de Vehículo': 'bg-orange-500',
  'Robo de Objetos Personales': 'bg-purple-500',
  'Pérdida de Objetos': 'bg-blue-500',
  'Encontrado': 'bg-green-500',
  'Otros': 'bg-gray-500'
}

const getCategoryColor = (category: string) => CATEGORY_COLORS[category] || 'bg-gray-500'

const formatDate = (dateString: string) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}

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

  // Address Autocomplete State
  const [addressQuery, setAddressQuery] = useState('')
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([])
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number, lng: number, label: string } | null>(null)

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

    // Location Filter
    if (selectedLocation) {
      f.lat = selectedLocation.lat
      f.lng = selectedLocation.lng
      f.radius = 2000 // 2km radius hardcoded for now, could be dynamic
    }

    return Object.keys(f).length > 0 ? f : undefined
  }, [selectedCategory, selectedStatus, debouncedSearchTerm, startDate, endDate, sortBy, selectedLocation])

  // React Query - cached, deduplicated, background refetch
  const { data: reports = [], isLoading, isFetching, error: queryError, refetch } = useReportsQuery(filters)

  // ============================================
  // HANDLERS (memoized with useCallback)
  // ============================================

  // Error message from query
  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null

  const handleFavoriteUpdate = useCallback((reportId: string, newState: boolean) => {
    // Optimistically update cache
    queryClient.setQueryData<Report[]>(
      queryKeys.reports.list(filters),
      (old) => old?.map(r => r.id === reportId ? { ...r, is_favorite: newState } : r)
    )
  }, [queryClient, filters])

  const handleFlag = useCallback((e: React.MouseEvent, reportId: string) => {
    e.preventDefault()
    e.stopPropagation()

    // Validaciones frontend
    const report = reports.find(r => r.id === reportId)
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
  }, [reports, flaggingReports])

  const handleFlagSubmit = useCallback(async (reason: string) => {
    if (!flaggingReportId) return

    const reportId = flaggingReportId
    const report = reports.find(r => r.id === reportId)

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

    // Save previous state for rollback
    const previousReports = queryClient.getQueryData<Report[]>(queryKeys.reports.list(filters))

    // Optimistic update: actualizar cache inmediatamente
    queryClient.setQueryData<Report[]>(
      queryKeys.reports.list(filters),
      (old) => old?.map(r => {
        if (r.id !== reportId) return r
        return {
          ...r,
          is_flagged: true,
          flags_count: (r.flags_count ?? 0) + 1
        }
      })
    )

    try {
      await reportsApi.flag(reportId, reason.trim())

      // Cerrar modal
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
    } catch (error) {
      // Revertir optimistic update en caso de error
      if (previousReports) {
        queryClient.setQueryData(queryKeys.reports.list(filters), previousReports)
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
  }, [flaggingReportId, reports, toast, queryClient, filters])


  const seo = generateSEOTags({
    title: 'Lista de Reportes – SafeSpot',
    description: 'Consulta todos los incidentes reportados por la comunidad. Filtra por categoría, zona y estado para encontrar reportes relevantes.',
    canonical: 'https://safespot.netlify.app/reportes',
    type: 'website'
  })

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.canonical} />

        {/* Open Graph */}
        <meta property="og:type" content={seo.ogType} />
        <meta property="og:url" content={seo.ogUrl} />
        <meta property="og:title" content={seo.ogTitle} />
        <meta property="og:description" content={seo.ogDescription} />
        <meta property="og:image" content={seo.ogImage} />
        <meta property="og:image:width" content={seo.ogImageWidth} />
        <meta property="og:image:height" content={seo.ogImageHeight} />
        <meta property="og:site_name" content={seo.ogSiteName} />
        <meta property="og:locale" content={seo.ogLocale} />

        {/* Twitter */}
        <meta name="twitter:card" content={seo.twitterCard} />
        <meta name="twitter:title" content={seo.twitterTitle} />
        <meta name="twitter:description" content={seo.twitterDescription} />
        <meta name="twitter:image" content={seo.twitterImage} />
      </Helmet>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          Lista de Reportes
        </h1>
        <p className="text-muted-foreground">
          Explora y filtra todos los reportes de la comunidad
        </p>
      </div>

      {/* Filtros */}
      <Card className="mb-8 bg-dark-card border-dark-border">
        <CardHeader className="pb-3 border-b border-dark-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-neon-green" />
              <h2 className="text-xl font-semibold">Filtros</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="text-muted-foreground hover:text-neon-green"
            >
              {showAdvancedFilters ? (
                <>
                  <span className="mr-2">Menos filtros</span>
                  <ChevronUp className="h-4 w-4" />
                </>
              ) : (
                <>
                  <span className="mr-2">Más filtros</span>
                  <ChevronDown className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-6">
          {/* Filtros Básicos (Siempre visibles) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            {/* Búsqueda Global */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, desc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
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

            {/* Ordenar Por (Movido a básico por utilidad) */}
            <Select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
            >
              <option value="recent">Más Recientes</option>
              <option value="popular">Más Populares</option>
              <option value="oldest">Más Antiguos</option>
            </Select>
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
                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar dirección..."
                      value={addressQuery}
                      onChange={(e) => {
                        setAddressQuery(e.target.value)
                        if (selectedLocation && e.target.value !== selectedLocation.label) {
                          setSelectedLocation(null) // Reset location filter if user types
                        }
                      }}
                      className={`pl-10 ${selectedLocation ? 'ring-1 ring-neon-green/50 border-neon-green/50' : ''}`}
                    />
                    {selectedLocation && (
                      <button
                        onClick={() => {
                          setSelectedLocation(null)
                          setAddressQuery('')
                        }}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-white/10 rounded-full"
                      >
                        <X className="h-3 w-3 text-muted-foreground" />
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

      {/* Listado de Reportes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">
            Reportes {isFetching ? '...' : `(${reports.length})`}
          </h2>
          <Link to="/crear-reporte">
            <Button variant="neon">
              Crear Nuevo Reporte
            </Button>
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ReportCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card className="bg-dark-card border-dark-border">
            <CardContent className="py-12 text-center">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={() => refetch()} variant="outline">
                Reintentar
              </Button>
            </CardContent>
          </Card>
        ) : reports.length === 0 ? (
          <Card className="bg-dark-card border-dark-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                No se encontraron reportes con los filtros seleccionados.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports
              .filter((report) => {
                // Defensive: filter out any invalid reports
                return (
                  report != null &&
                  typeof report === 'object' &&
                  report.id != null &&
                  typeof report.id === 'string' &&
                  report.title != null &&
                  typeof report.title === 'string'
                )
              })
              .map((report) => {
                // Additional defensive check inside map
                if (!report || !report.id) {
                  return null
                }

                const imageUrls: string[] = Array.isArray(report.image_urls) ? report.image_urls : []
                const hasImage = imageUrls.length > 0

                return (
                  <SmartLink
                    key={report.id}
                    to={`/reporte/${report.id}`}
                    prefetchReportId={report.id}
                    prefetchRoute="DetalleReporte"
                    className="block h-full no-underline"
                  >
                    <AnimatedCard className="h-full">
                      <Card className={`group bg-dark-card border-white/5 hover:border-neon-green/30 transition-all duration-300 h-full flex flex-col overflow-hidden relative ${report.priority_zone ? 'ring-1 ring-neon-green/30 border-neon-green/20' : ''}`}>
                        {report.priority_zone && (
                          <div className={`absolute top-0 right-0 px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider shadow-lg ${report.priority_zone === 'home' ? 'bg-emerald-500 text-white' :
                            report.priority_zone === 'work' ? 'bg-blue-500 text-white' :
                              'bg-amber-500 text-white'
                            }`}>
                            {report.priority_zone === 'home' && <Home className="w-3 h-3" />}
                            {report.priority_zone === 'work' && <Briefcase className="w-3 h-3" />}
                            {report.priority_zone === 'frequent' && <MapPin className="w-3 h-3" />}
                            {report.priority_zone === 'home' ? 'Tu Casa' : report.priority_zone === 'work' ? 'Tu Trabajo' : 'Tu Zona'}
                          </div>
                        )}

                        <div className="relative aspect-video w-full overflow-hidden bg-dark-bg/50">
                          {hasImage && (
                            <div className="relative overflow-hidden">
                              <OptimizedImage
                                src={imageUrls[0]}
                                alt={report.title}
                                aspectRatio={16 / 9}
                                priority={false}
                                className="w-full"
                              />
                              {/* Overlays (Top Right) */}
                              <div className="absolute top-2 right-2 flex gap-2 z-10">
                                <Badge className={getStatusColor(report.status)}>
                                  {getStatusLabel(report.status)}
                                </Badge>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 2.3 Content Section (Bottom) */}
                        <CardContent className="p-6 flex-1 flex flex-col">
                          {/* A. Header (Title & Category) */}
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="text-lg font-semibold text-foreground line-clamp-2 flex-1">
                              {report.title}
                            </h3>
                            {!hasImage && (
                              <Badge className={`ml-2 ${getStatusColor(report.status)}`}>
                                {getStatusLabel(report.status)}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                            <div className={`w-3 h-3 rounded-full ${getCategoryColor(report.category)}`} />
                            <span>{report.category}</span>
                          </div>

                          {/* B. Description */}
                          <p className="text-foreground/70 text-sm mb-4 line-clamp-3">
                            {report.description}
                          </p>

                          {/* C. Location */}
                          <div className="flex items-center text-sm text-foreground/60 mb-4 mt-auto">
                            <MapPin className="h-4 w-4 mr-1 text-neon-green" />
                            <span className="truncate">{report.address || report.zone || 'Ubicación no especificada'}</span>
                          </div>

                          {/* D. Meta Footer (Date & Stats) */}
                          <div className="flex items-center justify-between text-sm text-foreground/60 mb-4">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6 border border-white/10 shrink-0">
                                <AvatarImage
                                  src={report.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${report.anonymous_id}`}
                                  alt="Avatar"
                                />
                                <AvatarFallback className="bg-dark-bg text-[10px] text-gray-400">
                                  {report.anonymous_id.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs">{formatDate(report.created_at)}</span>
                            </div>
                            <div className="flex items-center space-x-4">
                              <div className="flex items-center gap-1" title="Hilos">
                                <GitBranch className="h-4 w-4" />
                                <span>{report.threads_count ?? 0}</span>
                              </div>
                              <div className="flex items-center gap-1" title="Comentarios">
                                <MessageCircle className="h-4 w-4" />
                                <span>{report.comments_count}</span>
                              </div>
                            </div>
                          </div>

                          {/* E. Action Bar (Bottom) */}
                          <div className="flex items-center justify-between pt-4 border-t border-dark-border mt-auto">
                            <span className="text-neon-green font-medium text-sm">Ver Detalles →</span>
                            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                              {(() => {
                                if (!report || !report.id) return null
                                return (
                                  <FavoriteButton
                                    reportId={report.id}
                                    isFavorite={report.is_favorite ?? false}
                                    onToggle={(newState) => handleFavoriteUpdate(report.id, newState)}
                                  />
                                )
                              })()}
                              {(() => {
                                const currentAnonymousId = getAnonymousIdSafe()
                                const isOwner = report?.anonymous_id === currentAnonymousId
                                const isFlagged = report?.is_flagged ?? false
                                const isFlagging = flaggingReports.has(report.id)

                                if (isOwner) return null

                                if (isFlagged) {
                                  return (
                                    <span className="text-xs text-foreground/60" title="Ya has denunciado este reporte">
                                      Denunciado
                                    </span>
                                  )
                                }

                                return (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      handleFlag(e, report.id)
                                    }}
                                    disabled={isFlagging}
                                    className="hover:text-yellow-400"
                                    title={isFlagging ? 'Reportando...' : 'Reportar contenido inapropiado'}
                                  >
                                    {isFlagging ? (
                                      <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
                                    ) : (
                                      <Flag className="h-4 w-4" />
                                    )}
                                  </Button>
                                )
                              })()}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </AnimatedCard>
                  </SmartLink>
                )
              })
              .filter(Boolean) // Remove any null entries from map
            }
          </div>
        )}
      </div>

      {/* Flag Dialog */}
      {isFlagDialogOpen && (
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
      )}
    </div>
  )
}
