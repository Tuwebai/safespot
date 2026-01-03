import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { favoritesApi } from '@/lib/api'
import { useToast } from '@/components/ui/toast'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MapPin, GitBranch, MessageCircle, Heart, AlertCircle } from 'lucide-react'
import type { Report } from '@/lib/api'
import { ReportCardSkeleton } from '@/components/ui/skeletons'
import { FavoriteButton } from '@/components/FavoriteButton'
import { prefetchReport, prefetchRouteChunk } from '@/lib/prefetch'
import { OptimizedImage } from '@/components/OptimizedImage'
import { useRef } from 'react'
import { useWindowVirtualizer } from '@tanstack/react-virtual'

export function MisFavoritos() {
  const navigate = useNavigate()
  const toast = useToast()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Update local state when a favorite is toggled (removed)
  const handleFavoriteToggle = useCallback((reportId: string, isFavorite: boolean) => {
    if (!isFavorite) {
      // If unfavorited, remove from list immediately
      setReports(prev => prev.filter(r => r.id !== reportId))
    }
  }, [])

  const loadFavorites = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await favoritesApi.getAll()
      setReports(data)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar favoritos'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

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

  const getStatusLabel = (status: Report['status']) => {
    const labelMap: Record<Report['status'], string> = {
      'pendiente': 'Buscando',
      'en_proceso': 'En Proceso',
      'resuelto': 'Recuperado',
      'cerrado': 'Expirado'
    }
    return labelMap[status] || status
  }

  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      'Celulares': 'bg-red-500',
      'Bicicletas': 'bg-orange-500',
      'Motos': 'bg-purple-500',
      'Autos': 'bg-blue-500',
      'Laptops': 'bg-green-500',
      'Carteras': 'bg-pink-500'
    }
    return colorMap[category] || 'bg-gray-500'
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Mis Favoritos</h1>
          <p className="text-foreground/70">Cargando...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ReportCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="bg-dark-card border-dark-border max-w-md">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Error al cargar favoritos</h2>
              <p className="text-foreground/70 mb-4">{error}</p>
              <Button
                onClick={loadFavorites}
                className="bg-neon-green hover:bg-neon-green/90 text-dark-bg"
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Mis Favoritos</h1>
          <p className="text-foreground/70">Reportes que has guardado como favoritos</p>
        </div>

        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="bg-dark-card border-dark-border max-w-md">
            <CardContent className="p-6 text-center">
              <Heart className="h-12 w-12 text-foreground/30 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">No tienes favoritos aún</h2>
              <p className="text-foreground/70 mb-4">
                Los reportes que marques como favoritos aparecerán aquí
              </p>
              <Button
                onClick={() => navigate('/reportes')}
                className="bg-neon-green hover:bg-neon-green/90 text-dark-bg"
              >
                Explorar Reportes
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const parentRef = useRef<HTMLDivElement>(null)

  const [columns, setColumns] = useState(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1)
  const [scrollMargin, setScrollMargin] = useState(0)

  useEffect(() => {
    const handleLayoutUpdate = () => {
      setColumns(window.innerWidth >= 1024 ? 3 : window.innerWidth >= 768 ? 2 : 1)
      if (parentRef.current) {
        setScrollMargin(parentRef.current.offsetTop)
      }
    }

    // Calcular inicial
    handleLayoutUpdate()

    // Observar cambios de tamaño
    window.addEventListener('resize', handleLayoutUpdate)

    // Pequeño delay para asegurar que el DOM se ha asentado
    const timeout = setTimeout(handleLayoutUpdate, 100)

    return () => {
      window.removeEventListener('resize', handleLayoutUpdate)
      clearTimeout(timeout)
    }
  }, [reports.length])

  // Virtualizer setup using window scroll
  const rowVirtualizer = useWindowVirtualizer({
    count: Math.ceil(reports.length / columns),
    estimateSize: () => 480,
    overscan: 5,
    scrollMargin,
  })

  // Resize listener
  useEffect(() => {
    rowVirtualizer.measure()
  }, [columns, rowVirtualizer])

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold gradient-text mb-2">Mis Favoritos</h1>
        <p className="text-foreground/70">
          {reports.length} {reports.length === 1 ? 'reporte guardado' : 'reportes guardados'}
        </p>
      </div>

      <div
        ref={parentRef}
        className="w-full"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columns
            const rowItems = reports
              .filter((report) => {
                return (
                  report != null &&
                  typeof report === 'object' &&
                  report.id != null &&
                  typeof report.id === 'string' &&
                  report.title != null &&
                  typeof report.title === 'string'
                )
              })
              .slice(startIndex, startIndex + columns)

            return (
              <div
                key={virtualRow.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {rowItems.map((report) => (
                  <Card
                    key={report.id}
                    className="card-glow bg-dark-card border-dark-border hover:border-neon-green/50 transition-colors overflow-hidden cursor-pointer"
                    onMouseEnter={() => {
                      prefetchRouteChunk('DetalleReporte')
                      prefetchReport(report.id)
                    }}
                    onClick={() => navigate(`/reporte/${report.id}`)}
                  >
                    {/* Image Section (Top) */}
                    {Array.isArray(report.image_urls) && report.image_urls.length > 0 && (
                      <div className="relative h-48 w-full overflow-hidden rounded-t-lg bg-dark-bg/50">
                        <OptimizedImage
                          src={report.image_urls[0]}
                          alt={report.title}
                          aspectRatio={16 / 9}
                          className="w-full h-full"
                        />
                        <div className="absolute top-2 right-2 flex gap-2">
                          <Badge className={getStatusColor(report.status)}>
                            {getStatusLabel(report.status)}
                          </Badge>
                        </div>
                      </div>
                    )}

                    <CardContent className="p-6">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-lg font-semibold text-foreground line-clamp-2 flex-1">
                          {report.title}
                        </h3>
                        {(!Array.isArray(report.image_urls) || report.image_urls.length === 0) && (
                          <Badge className={`ml-2 ${getStatusColor(report.status)}`}>
                            {getStatusLabel(report.status)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mb-2">
                        <div className={`w-3 h-3 rounded-full ${getCategoryColor(report.category)}`} />
                        <span className="text-xs text-muted-foreground">{report.category}</span>
                      </div>

                      <p className="text-foreground/70 text-sm mb-4 line-clamp-3">
                        {report.description}
                      </p>

                      <div className="flex items-center text-sm text-foreground/60 mb-4">
                        <MapPin className="h-4 w-4 mr-1" />
                        <span className="truncate">{report.address || report.zone || 'Ubicación no especificada'}</span>
                      </div>

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

                      <div className="flex items-center justify-between pt-4 border-t border-dark-border">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-neon-green text-neon-green hover:bg-neon-green/10"
                          onClick={(e) => {
                            e.preventDefault()
                            navigate(`/reporte/${report.id}`)
                          }}
                        >
                          Ver Detalles
                        </Button>
                        <div className="flex items-center">
                          <FavoriteButton
                            reportId={report.id}
                            isFavorite={true}
                            onToggle={(newState) => handleFavoriteToggle(report.id, newState)}
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

