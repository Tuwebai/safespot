import { useState, useCallback, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { Link, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { ALL_CATEGORIES as categories, ZONES as zones, STATUS_OPTIONS as statusOptions } from '@/lib/constants'
import { reportsApi } from '@/lib/api'
import { getAnonymousIdSafe } from '@/lib/identity'
import { useToast } from '@/components/ui/toast'
import { handleErrorWithMessage } from '@/lib/errorHandler'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Filter, GitBranch, MessageCircle, Flag } from 'lucide-react'
import type { Report, ReportFilters } from '@/lib/api'
import { ReportCardSkeleton } from '@/components/ui/skeletons'
import { OptimizedImage } from '@/components/OptimizedImage'
import { FavoriteButton } from '@/components/FavoriteButton'
import { prefetchReport, prefetchRouteChunk } from '@/lib/prefetch'
import { useReportsQuery } from '@/hooks/queries'
import { useDebounce } from '@/hooks/useDebounce'
import { queryKeys } from '@/lib/queryKeys'

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
  const navigate = useNavigate()
  const toast = useToast()
  const queryClient = useQueryClient()

  // Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

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
    if (selectedZone !== 'all') f.zone = selectedZone
    if (selectedStatus !== 'all') f.status = selectedStatus
    if (debouncedSearchTerm.trim()) f.search = debouncedSearchTerm.trim()
    return Object.keys(f).length > 0 ? f : undefined
  }, [selectedCategory, selectedZone, selectedStatus, debouncedSearchTerm])

  // React Query - cached, deduplicated, background refetch
  const { data: reports = [], isLoading: loading, error: queryError, refetch } = useReportsQuery(filters)

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

  // Optimization: Stable handlers for list items
  const handleCardHover = useCallback((reportId: string) => {
    prefetchRouteChunk('DetalleReporte')
    prefetchReport(reportId)
  }, [])

  const handleCardClick = useCallback((reportId: string, e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    navigate(`/reporte/${reportId}`)
  }, [navigate])

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <Helmet>
        <title>Lista de Reportes – SafeSpot</title>
        <meta name="description" content="Consulta la lista completa de incidentes reportados por la comunidad. Filtra por categoría y zona." />
        <meta property="og:title" content="Lista de Reportes – SafeSpot" />
        <meta property="og:description" content="Consulta la lista completa de incidentes reportados por la comunidad. Filtra por categoría y zona." />
      </Helmet>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="gradient-text">Reportes</span>
        </h1>
        <p className="text-muted-foreground">
          Explora y filtra todos los reportes de la comunidad
        </p>
      </div>

      {/* Filtros */}
      <Card className="mb-8 bg-dark-card border-dark-border">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-neon-green" />
            <h2 className="text-xl font-semibold">Filtros</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Búsqueda */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar reportes..."
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

            {/* Zona */}
            <Select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              <option value="all">Todas las zonas</option>
              {zones.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
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
          </div>
        </CardContent>
      </Card>

      {/* Listado de Reportes */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">
            Reportes {loading ? '...' : `(${reports.length})`}
          </h2>
          <Link to="/crear-reporte">
            <Button variant="neon">
              Crear Nuevo Reporte
            </Button>
          </Link>
        </div>

        {loading ? (
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
                  <Card
                    key={report.id}
                    className="card-glow bg-dark-card border-dark-border hover:border-neon-green/50 transition-colors overflow-hidden cursor-pointer"
                    onMouseEnter={() => handleCardHover(report.id)}
                    onClick={() => handleCardClick(report.id)}
                  >
                    {/* 2.2 Image Section (Top) - Optimized */}
                    {hasImage && (
                      <div className="relative overflow-hidden rounded-t-lg">
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

                    {/* 2.3 Content Section (Bottom) */}
                    <CardContent className="p-6">
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
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getCategoryColor(report.category)}`} />
                        <span className="text-xs text-muted-foreground">{report.category}</span>
                      </div>

                      {/* B. Description */}
                      <p className="text-foreground/70 text-sm mb-4 line-clamp-3">
                        {report.description}
                      </p>

                      {/* C. Location */}
                      <div className="flex items-center text-sm text-foreground/60 mb-4">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="truncate">{report.zone}</span>
                      </div>

                      {/* D. Meta Footer (Date & Stats) */}
                      <div className="flex items-center justify-between text-sm text-foreground/60 mb-4">
                        <span>{formatDate(report.created_at)}</span>
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
                      <div className="flex items-center justify-between pt-4 border-t border-dark-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-neon-green text-neon-green hover:bg-neon-green/10"
                          onClick={(e) => handleCardClick(report.id, e)}
                        >
                          Ver Detalles
                        </Button>
                        <div className="flex items-center space-x-2">
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

                            // NO mostrar si es owner
                            if (isOwner) {
                              return null
                            }

                            // NO mostrar si ya está flaggeado
                            if (isFlagged) {
                              return (
                                <span className="text-xs text-foreground/60" title="Ya has denunciado este reporte">
                                  Denunciado
                                </span>
                              )
                            }

                            // Mostrar botón de flag en cualquier otro caso
                            return (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => handleFlag(e, report.id)}
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
