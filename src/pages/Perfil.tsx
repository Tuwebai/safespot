import { useState, useEffect } from 'react'
import { usersApi, reportsApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { handleError } from '@/lib/errorHandler'
import { User, Award, TrendingUp, Calendar, FileText, ThumbsUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getAnonymousIdSafe } from '@/lib/identity'
import type { UserProfile, Report } from '@/lib/api'

export function Perfil() {
  const toast = useToast()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const data = await usersApi.getProfile()
      setProfile(data)
      setError(null)
    } catch (error) {
      const errorInfo = handleError(error, toast.error, 'Perfil.loadProfile')
      setError(errorInfo.userMessage)
    } finally {
      setLoading(false)
    }
  }

  const getLevelProgress = () => {
    if (!profile) return 0
    const currentLevelPoints = (profile.level - 1) * 200
    const nextLevelPoints = profile.level * 200
    const progress = ((profile.points - currentLevelPoints) / (nextLevelPoints - currentLevelPoints)) * 100
    return Math.min(100, Math.max(0, progress))
  }

  const anonymousId = getAnonymousIdSafe()

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-dark-card border-dark-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Cargando perfil...</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-dark-card border-dark-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error || 'Error al cargar perfil'}</p>
            <Button variant="outline" onClick={loadProfile} className="mt-4">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userReports = profile.recent_reports || []

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="gradient-text">Perfil Anónimo</span>
        </h1>
        <p className="text-muted-foreground">
          Tu actividad y logros en SafeSpot
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Principal */}
        <div className="lg:col-span-2 space-y-6">
          {/* Información del Usuario */}
          <Card className="bg-dark-card border-dark-border card-glow">
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-full bg-neon-green/20 flex items-center justify-center">
                  <User className="h-8 w-8 text-neon-green" />
                </div>
                <div>
                  <CardTitle className="text-2xl">Usuario Anónimo</CardTitle>
                  <CardDescription className="text-base">
                    ID: {anonymousId}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Nivel y Puntos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Nivel {profile.level}</span>
                    <span className="text-sm text-muted-foreground">
                      {profile.points} puntos
                    </span>
                  </div>
                  <div className="w-full bg-dark-bg rounded-full h-2">
                    <div
                      className="bg-neon-green h-2 rounded-full transition-all"
                      style={{ width: `${getLevelProgress()}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {profile.level * 200 - profile.points} puntos para el siguiente nivel
                  </p>
                </div>

                {/* Estadísticas */}
                <div className="grid grid-cols-3 gap-4 pt-4 border-t border-dark-border">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-neon-green">
                      {profile.total_reports}
                    </div>
                    <div className="text-xs text-muted-foreground">Reportes</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-neon-green">
                      {profile.total_votes}
                    </div>
                    <div className="text-xs text-muted-foreground">Apoyos</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-neon-green">
                      {profile.level}
                    </div>
                    <div className="text-xs text-muted-foreground">Nivel</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Mis Reportes */}
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Mis Reportes ({userReports.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userReports.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground mb-4">
                    Aún no has creado ningún reporte
                  </p>
                  <Link to="/crear-reporte">
                    <Button variant="neon">Crear Primer Reporte</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {userReports.map((report) => (
                    <Link key={report.id} to={`/reporte/${report.id}`}>
                      <div className="p-4 rounded-lg bg-dark-bg border border-dark-border hover:border-neon-green/50 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold line-clamp-1">{report.title}</h3>
                          <Badge variant="outline">{report.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {report.description}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" />
                            {report.upvotes_count}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(report.created_at).toLocaleDateString('es-AR')}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Actividad Reciente */}
          <Card className="bg-dark-card border-dark-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Actividad
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm">
                  <div className="font-medium mb-1">Miembro desde</div>
                  <div className="text-muted-foreground">
                    {new Date(profile.created_at).toLocaleDateString('es-AR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="font-medium mb-1">Puntos totales</div>
                  <div className="text-neon-green text-lg font-bold">
                    {profile.points}
                  </div>
                </div>
                <div className="text-sm">
                  <div className="font-medium mb-1">Comentarios</div>
                  <div className="text-neon-green text-lg font-bold">
                    {profile.total_comments}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA Crear Reporte */}
          <Card className="bg-dark-card border-dark-border border-neon-green/20">
            <CardContent className="pt-6">
              <div className="text-center">
                <h3 className="font-semibold mb-2">¿Viste un problema?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Reporta problemas en tu ciudad
                </p>
                <Link to="/crear-reporte">
                  <Button variant="neon" className="w-full">
                    Crear Reporte
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
