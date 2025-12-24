import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ALL_CATEGORIES as categories, ZONES as zones, STATUS_OPTIONS as statusOptions } from '@/lib/constants'
import { reportsApi } from '@/lib/api'
import { getAnonymousId } from '@/lib/identity'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, MapPin, Filter, Eye, MessageCircle, Heart, Flag } from 'lucide-react'
import type { Report } from '@/lib/api'

export function Reportes() {
  const navigate = useNavigate()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedZone, setSelectedZone] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [isFlagDialogOpen, setIsFlagDialogOpen] = useState(false)
  const [flaggingReportId, setFlaggingReportId] = useState<string | null>(null)
  const [flaggingReports, setFlaggingReports] = useState<Set<string>>(new Set())

  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const filters: any = {}
      if (selectedCategory !== 'all') filters.category = selectedCategory
      if (selectedZone !== 'all') filters.zone = selectedZone
      if (selectedStatus !== 'all') filters.status = selectedStatus
      if (searchTerm.trim()) filters.search = searchTerm.trim()
      
      const data = await reportsApi.getAll(filters)
      setReports(data)
    } catch (error) {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [selectedCategory, selectedZone, selectedStatus, searchTerm])

  // Debounced search and filters
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      loadReports()
    }, searchTerm ? 500 : 0)

    return () => clearTimeout(timeoutId)
  }, [searchTerm, selectedCategory, selectedZone, selectedStatus, loadReports])

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
      'Robo de Bicicleta': 'bg-red-500',
      'Robo de Vehículo': 'bg-orange-500',
      'Robo de Objetos Personales': 'bg-purple-500',
      'Pérdida de Objetos': 'bg-blue-500',
      'Encontrado': 'bg-green-500',
      'Otros': 'bg-gray-500'
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

  const handleSave = async (e: React.MouseEvent, reportId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Optimistic update: update UI immediately
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r
      
      // Toggle the favorite status optimistically
      const currentFavorite = r.is_favorite ?? false
      return { ...r, is_favorite: !currentFavorite }
    }))
    
    try {
      const result = await reportsApi.toggleFavorite(reportId)
      
      // Update with actual server response
      setReports(prev => prev.map(r => {
        if (r.id !== reportId) return r
        return { ...r, is_favorite: result.is_favorite ?? false }
      }))
    } catch (error) {
      // Revert optimistic update on error
      setReports(prev => prev.map(r => {
        if (r.id !== reportId) return r
        
        // Revert to previous state
        const currentFavorite = r.is_favorite ?? false
        return { ...r, is_favorite: !currentFavorite }
      }))
      
      console.error('Error toggling favorite:', error)
      alert(error instanceof Error ? error.message : 'Error al guardar en favoritos')
    }
  }

  const handleFlag = (e: React.MouseEvent, reportId: string) => {
    e.preventDefault()
    e.stopPropagation()
    
    // Validaciones frontend
    const report = reports.find(r => r.id === reportId)
    if (!report) return
    
    const currentAnonymousId = getAnonymousId()
    if (!currentAnonymousId) return
    
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
  }

  const handleFlagSubmit = async (reason: string) => {
    if (!flaggingReportId) return
    
    const reportId = flaggingReportId
    const report = reports.find(r => r.id === reportId)
    
    if (!report) {
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
      return
    }
    
    // Validaciones finales
    const currentAnonymousId = getAnonymousId()
    if (!currentAnonymousId || report.anonymous_id === currentAnonymousId || report.is_flagged === true) {
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
      return
    }
    
    // Marcar como en proceso
    setFlaggingReports(prev => new Set(prev).add(reportId))
    
    // Optimistic update: actualizar UI inmediatamente
    setReports(prev => prev.map(r => {
      if (r.id !== reportId) return r
      return {
        ...r,
        is_flagged: true,
        flags_count: (r.flags_count ?? 0) + 1
      }
    }))
    
    try {
      await reportsApi.flag(reportId, reason.trim())
      
      // Cerrar modal
      setIsFlagDialogOpen(false)
      setFlaggingReportId(null)
    } catch (error) {
      // Revertir optimistic update en caso de error
      setReports(prev => prev.map(r => {
        if (r.id !== reportId) return r
        return {
          ...r,
          is_flagged: false,
          flags_count: Math.max(0, (r.flags_count ?? 0) - 1)
        }
      }))
      
      const errorMessage = error instanceof Error ? error.message : 'Error al denunciar el reporte'
      
      if (errorMessage.includes('own report')) {
        alert('No puedes denunciar tu propio reporte')
      } else if (errorMessage.includes('already flagged')) {
        alert('Ya has denunciado este reporte anteriormente')
      } else {
        alert(errorMessage)
      }
    } finally {
      // Remover de flagging en proceso
      setFlaggingReports(prev => {
        const newSet = new Set(prev)
        newSet.delete(reportId)
        return newSet
      })
    }
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
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
          <Card className="bg-dark-card border-dark-border">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Cargando reportes...</p>
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
              .filter((report) => report != null && report.id != null) // Defensive: filter out any invalid reports
              .map((report) => {
                const imageUrls: string[] = report?.image_urls ?? [] // Use image_urls from report if available
                const hasImage = imageUrls.length > 0

                return (
                  <Card
                    key={report.id}
                    className="card-glow bg-dark-card border-dark-border hover:border-neon-green/50 transition-colors overflow-hidden"
                  >
                  {/* 2.2 Image Section (Top) */}
                  {hasImage && (
                    <div className="relative h-48 w-full overflow-hidden rounded-t-lg">
                      <img
                        src={imageUrls[0]}
                        alt={report.title}
                        className="w-full h-full object-cover"
                      />
                      {/* Overlays (Top Right) */}
                      <div className="absolute top-2 right-2 flex gap-2">
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
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4" />
                          <span>{report.upvotes_count}</span>
                        </div>
                        <div className="flex items-center gap-1">
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
                        onClick={(e) => {
                          e.preventDefault()
                          navigate(`/reporte/${report.id}`)
                        }}
                      >
                        Ver Detalles
                      </Button>
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const isFavorite = report?.is_favorite ?? false
                          return (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => handleSave(e, report.id)}
                              className={isFavorite ? 'text-red-400 hover:text-red-300' : ''}
                              title={isFavorite ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                            >
                              <Heart className={`h-4 w-4 ${isFavorite ? 'fill-current' : ''}`} />
                            </Button>
                          )
                        })()}
                        {(() => {
                          const currentAnonymousId = getAnonymousId()
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
                              title="Reportar contenido inapropiado"
                            >
                              <Flag className="h-4 w-4" />
                            </Button>
                          )
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
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
                {['Spam', 'Contenido Inapropiado', 'Información Falsa', 'Otro'].map((reason) => (
                  <Button
                    key={reason}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleFlagSubmit(reason)}
                    disabled={flaggingReports.has(flaggingReportId ?? '')}
                  >
                    {reason}
                  </Button>
                ))}
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
