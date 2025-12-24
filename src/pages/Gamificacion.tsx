import { useState, useEffect } from 'react'
import { usersApi } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Award, TrendingUp, Trophy, Star } from 'lucide-react'
import type { UserProfile } from '@/lib/api'

export function Gamificacion() {
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
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error al cargar perfil')
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

  if (loading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-dark-card border-dark-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Cargando gamificación...</p>
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
            <p className="text-muted-foreground">{error || 'Error al cargar gamificación'}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Mock badges for now (will be implemented in backend later)
  const badges: string[] = []
  if (profile.total_reports >= 1) badges.push('Primer Reporte')
  if (profile.total_reports >= 5) badges.push('Colaborador Activo')
  if (profile.total_reports >= 10) badges.push('Top Reporter')

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">
          <span className="gradient-text">Gamificación</span>
        </h1>
        <p className="text-muted-foreground">
          Tu progreso, logros e insignias en SafeSpot
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nivel y Progreso */}
        <Card className="lg:col-span-2 bg-dark-card border-dark-border card-glow">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-neon-green" />
              Tu Nivel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl font-bold text-neon-green mb-2">
                  Nivel {profile.level}
                </div>
                <div className="text-lg text-muted-foreground">
                  {profile.points} puntos totales
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Progreso al siguiente nivel</span>
                  <span className="text-sm text-muted-foreground">
                    {profile.level * 200 - profile.points} puntos restantes
                  </span>
                </div>
                <div className="w-full bg-dark-bg rounded-full h-4">
                  <div
                    className="bg-neon-green h-4 rounded-full transition-all"
                    style={{ width: `${getLevelProgress()}%` }}
                  />
                </div>
              </div>

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
                    {profile.points}
                  </div>
                  <div className="text-xs text-muted-foreground">Puntos</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Insignias */}
        <Card className="bg-dark-card border-dark-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-neon-green" />
              Insignias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {badges.length === 0 ? (
              <div className="text-center py-8">
                <Award className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Aún no has obtenido insignias. ¡Sigue reportando para ganarlas!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {badges.map((badge, index) => (
                  <Badge key={index} variant="default" className="w-full justify-start text-sm py-2 px-3">
                    <Star className="h-4 w-4 mr-2" />
                    {badge}
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Ranking (Mock) */}
      <Card className="mt-6 bg-dark-card border-dark-border">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-neon-green" />
            Ranking de la Comunidad
          </CardTitle>
          <CardDescription>
            Los usuarios más activos de SafeSpot
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-muted-foreground">
              El ranking se actualizará próximamente
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
