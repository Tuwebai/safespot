import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { reportsApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { handleError } from '@/lib/errorHandler'
import { MapPin, List, ThumbsUp, Calendar } from 'lucide-react'
import type { Report } from '@/lib/api'

export function Explorar() {
  const toast = useToast()
  const [viewMode, setViewMode] = useState<'map' | 'list'>('list')
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadReports()
  }, [])

  const loadReports = async () => {
    try {
      setLoading(true)
      const data = await reportsApi.getAll()
      setReports(data)
    } catch (error) {
      handleError(error, toast.error, 'Explorar.loadReports')
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadgeVariant = (status: Report['status']) => {
    switch (status) {
      case 'pendiente':
        return 'outline'
      case 'en_proceso':
        return 'secondary'
      case 'resuelto':
        return 'default'
      case 'cerrado':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const stats = {
    total: reports.length,
    pendientes: reports.filter(r => r.status === 'pendiente').length,
    en_proceso: reports.filter(r => r.status === 'en_proceso').length,
    resueltos: reports.filter(r => r.status === 'resuelto').length,
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-4xl font-bold mb-2">
              <span className="gradient-text">Explorar</span>
            </h1>
            <p className="text-muted-foreground">
              Explora todos los reportes en tu ciudad
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'list' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <MapPin className="h-4 w-4 mr-2" />
              Mapa
            </Button>
          </div>
        </div>
      </div>

      {/* Vista Mapa (Mock) */}
      {viewMode === 'map' && (
        <Card className="bg-dark-card border-dark-border mb-6">
          <CardContent className="p-12 text-center">
            <MapPin className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">Vista de Mapa</h3>
            <p className="text-muted-foreground mb-4">
              La integración del mapa se implementará en una fase posterior
            </p>
            <div className="bg-dark-bg border border-dark-border rounded-lg p-8 min-h-[400px] flex items-center justify-center">
              <p className="text-muted-foreground">
                Mapa interactivo con {reports.length} reportes
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Vista Lista */}
      {viewMode === 'list' && (
        <>
          {loading ? (
            <Card className="bg-dark-card border-dark-border">
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">Cargando reportes...</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {reports.map((report) => (
                <Link key={report.id} to={`/reporte/${report.id}`}>
                  <Card className="bg-dark-card border-dark-border hover:border-neon-green/50 transition-colors cursor-pointer card-glow h-full">
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <CardTitle className="text-xl line-clamp-2">{report.title}</CardTitle>
                        <Badge variant={getStatusBadgeVariant(report.status)}>
                          {report.status}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2">
                        {report.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4 mr-2" />
                          {report.zone} - {report.address}
                        </div>
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4 mr-2" />
                          {new Date(report.created_at).toLocaleDateString('es-AR')}
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-dark-border">
                          <div className="flex items-center text-sm text-muted-foreground">
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            {report.upvotes_count}
                          </div>
                          <Badge variant="outline">{report.category}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </>
      )}

      {/* Estadísticas */}
      <Card className="bg-dark-card border-dark-border">
        <CardHeader>
          <CardTitle>Estadísticas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-neon-green">{stats.total}</div>
              <div className="text-sm text-muted-foreground">Total Reportes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neon-green">{stats.pendientes}</div>
              <div className="text-sm text-muted-foreground">Pendientes</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neon-green">{stats.en_proceso}</div>
              <div className="text-sm text-muted-foreground">En Proceso</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-neon-green">{stats.resueltos}</div>
              <div className="text-sm text-muted-foreground">Resueltos</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
