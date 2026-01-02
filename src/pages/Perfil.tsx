import { useState, useEffect, useCallback } from 'react'
import { usersApi } from '@/lib/api'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { useToast } from '@/components/ui/toast'
import { handleError } from '@/lib/errorHandler'
import { TrendingUp, Calendar, FileText, ThumbsUp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PrefetchLink } from '@/components/PrefetchLink'
import { getAnonymousIdSafe } from '@/lib/identity'
import type { UserProfile } from '@/lib/api'
import { ProfileSkeleton } from '@/components/ui/profile-skeleton'
import { NotificationSettingsSection } from '@/components/NotificationSettingsSection'
import { AlertZoneStatusSection } from '@/components/AlertZoneStatusSection'
import { useGamificationSummaryQuery } from '@/hooks/queries/useGamificationQuery'
import { Lock, ChevronRight, Award } from 'lucide-react'
import { calculateLevelProgress, getPointsToNextLevel } from '@/lib/levelCalculation'

export function Perfil() {
  const toast = useToast()

  // Use React Query for real-time gamification data
  const {
    data: gamificationData,
    isLoading: gamificationLoading,
    error: gamificationError,
    refetch: refetchGamification
  } = useGamificationSummaryQuery()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadProfile = useCallback(async () => {
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
  }, [toast.error])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Logic to find the "Next Badge" (closest to completion)
  const getNextBadgeData = () => {
    if (!gamificationData?.badges) return null

    // Filter non-obtained badges and sort by progress percentage
    // Filter non-obtained badges and sort by progress percentage
    const pendingBadges = gamificationData.badges
      .filter(b => !b.obtained)
      .sort((a, b) => {
        const percentA = a.progress && a.progress.required ? (a.progress.current / a.progress.required) * 100 : 0;
        const percentB = b.progress && b.progress.required ? (b.progress.current / b.progress.required) * 100 : 0;
        return percentB - percentA;
      })

    return pendingBadges[0] || null
  }

  const nextBadge = getNextBadgeData()

  const anonymousId = getAnonymousIdSafe()

  if (loading || gamificationLoading) {
    return <ProfileSkeleton />
  }

  if ((error && gamificationError) || (!profile && !gamificationData)) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <Card className="bg-dark-card border-dark-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error || 'Error al cargar perfil'}</p>
            <Button variant="outline" onClick={() => { loadProfile(); refetchGamification(); }} className="mt-4">
              Reintentar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userReports = profile?.recent_reports || []

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
              <div className="flex items-center gap-6">
                <div className="relative group">
                  {/* Avatar Circle */}
                  <Avatar className="h-24 w-24 border-2 border-neon-green/30 group-hover:border-neon-green/80 transition-all shadow-[0_0_15px_rgba(0,255,136,0.1)]">
                    <AvatarImage
                      src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${anonymousId}`}
                      alt="Avatar"
                      className="object-cover"
                    />
                    <AvatarFallback className="bg-neon-green/10 text-neon-green text-3xl font-bold flex items-center justify-center">
                      {anonymousId.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Actions Overlay / Buttons */}
                  <div className="absolute -bottom-2 -right-2 flex space-x-1">
                    {/* Regenerate Random */}
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-8 w-8 rounded-full bg-dark-card border-neon-green/50 hover:bg-neon-green hover:text-black transition-colors"
                      )}
                      onClick={() => {
                        // Optimistic Update: Update UI immediately
                        const randomSeed = Math.random().toString(36).substring(7);
                        const newAvatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${anonymousId}-${randomSeed}`;

                        // 1. Update local state immediately
                        const previousProfile = profile;
                        setProfile(prev => prev ? { ...prev, avatar_url: newAvatarUrl } : null);

                        // 2. Persist in background (fire and forget from UI perspective, handle error)
                        usersApi.updateProfile({ avatar_url: newAvatarUrl })
                          .catch((err) => {
                            // Revert on error
                            setProfile(previousProfile);
                            handleError(err, toast.error, 'Perfil.regenerateAvatar');
                          });
                      }}
                      title="Generar aleatorio"
                      disabled={loading}
                    >
                      <span className="text-xs">🎲</span>
                    </Button>

                    {/* Upload Custom */}
                    <div className="relative">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        className="hidden"
                        id="avatar-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;

                          try {
                            const toastId = toast.info("Subiendo imagen...", 9999); // Persistent until success
                            const { avatar_url } = await usersApi.uploadAvatar(file);

                            toast.removeToast(toastId);

                            setProfile(prev => prev ? { ...prev, avatar_url } : null);
                            toast.success("Foto de perfil actualizada");
                          } catch (err) {
                            handleError(err, toast.error, 'Perfil.uploadAvatar');
                          } finally {
                            // Reset input
                            e.target.value = '';
                          }
                        }}
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 rounded-full bg-dark-card border-neon-green/50 hover:bg-neon-green hover:text-black transition-colors"
                        onClick={() => document.getElementById('avatar-upload')?.click()}
                        title="Subir imagen"
                      >
                        <span className="text-xs">📷</span>
                      </Button>
                    </div>
                  </div>
                </div>

                <div>
                  <CardTitle className="text-2xl flex items-center gap-2">
                    Usuario Anónimo
                    {profile?.avatar_url && (
                      <span className="text-[10px] bg-neon-green/20 text-neon-green px-2 py-0.5 rounded-full border border-neon-green/30">
                        Personalizado
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-base font-mono">
                    ID: {anonymousId}
                  </CardDescription>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[250px] leading-tight">
                    Tu identidad permanece anónima. La foto solo es visible en tu perfil.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Nivel y Puntos */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold tracking-tight">Nivel {gamificationData?.profile?.level ?? profile?.level}</span>
                    <span className="text-xs font-mono text-neon-green bg-neon-green/10 px-2 py-0.5 rounded">
                      {gamificationData?.profile?.points ?? profile?.points} PUNTOS
                    </span>
                  </div>
                  <div className="w-full bg-dark-bg rounded-full h-2.5 p-0.5 border border-white/5">
                    <div
                      className="bg-gradient-to-r from-neon-green to-emerald-400 h-1.5 rounded-full transition-all duration-1000"
                      style={{
                        width: `${calculateLevelProgress(
                          gamificationData?.profile?.points ?? profile?.points ?? 0,
                          gamificationData?.profile?.level ?? profile?.level ?? 1
                        )}%`
                      }}
                    />
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
                      {getPointsToNextLevel(
                        gamificationData?.profile?.points ?? profile?.points ?? 0,
                        gamificationData?.profile?.level ?? profile?.level ?? 1
                      )} pts para Nivel {(gamificationData?.profile?.level ?? profile?.level ?? 1) + 1}
                    </p>
                    <span className="text-[10px] font-bold text-neon-green/60">{Math.round(calculateLevelProgress(
                      gamificationData?.profile?.points ?? profile?.points ?? 0,
                      gamificationData?.profile?.level ?? profile?.level ?? 1
                    ))}%</span>
                  </div>
                </div>

                {/* Siguiente Logro (Next Badge) - v1.0 AUDIT IMPROVEMENT */}
                {nextBadge && (
                  <div className="pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-muted-foreground" />
                        <span className="text-[10px] uppercase font-black tracking-widest text-muted-foreground">Próximo Logro</span>
                      </div>
                      <span className="text-[10px] font-bold text-white/40">{nextBadge.progress.current} / {nextBadge.progress.required}</span>
                    </div>

                    <div className="bg-dark-bg/50 rounded-2xl p-4 border border-white/5 relative overflow-hidden group">
                      {/* Timeline Background Visual */}
                      <div className="absolute top-0 right-0 p-3 opacity-10 grayscale group-hover:grayscale-0 transition-all">
                        <span className="text-4xl">{nextBadge.icon}</span>
                      </div>

                      <div className="flex items-center gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center relative">
                          <span className="text-2xl grayscale opacity-40">{nextBadge.icon}</span>
                          <div className="absolute -top-1 -right-1">
                            <Lock className="w-3 h-3 text-muted-foreground" />
                          </div>
                        </div>

                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-foreground mb-0.5">{nextBadge.name}</h4>
                          <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1">
                            {nextBadge.description}
                          </p>

                          <div className="mt-3">
                            <div className="w-full bg-black/40 rounded-full h-1.5 overflow-hidden">
                              <div
                                className="bg-neon-green h-full rounded-full transition-all duration-1000 shadow-[0_0_8px_rgba(57,255,20,0.4)]"
                                style={{ width: `${nextBadge.progress.required ? (nextBadge.progress.current / nextBadge.progress.required) * 100 : 0}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-white/20" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Estadísticas */}
                <div className="grid grid-cols-3 gap-1 pt-6 border-t border-white/5">
                  <div className="text-center p-2 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-xl font-bold text-neon-green">
                      {gamificationData?.profile?.total_reports ?? profile?.total_reports}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Reportes</div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-xl font-bold text-neon-green">
                      {gamificationData?.profile?.total_votes ?? profile?.total_votes}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Apoyos</div>
                  </div>
                  <div className="text-center p-2 rounded-xl bg-white/5 border border-white/5">
                    <div className="text-xl font-bold text-neon-green">
                      {gamificationData?.profile?.total_comments ?? profile?.total_comments}
                    </div>
                    <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-tighter">Comentarios</div>
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
                    <PrefetchLink
                      key={report.id}
                      to={`/reporte/${report.id}`}
                      prefetchRoute="DetalleReporte"
                      prefetchReportId={report.id}
                    >
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
                    </PrefetchLink>
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
                Insignias Obtenidas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {(gamificationData?.badges || [])
                  .filter(b => b.obtained)
                  .map(badge => (
                    <div
                      key={badge.id}
                      className="p-2 bg-neon-green/10 border border-neon-green/20 rounded-xl flex flex-col items-center justify-center w-16 h-16 group relative"
                      title={badge.name}
                    >
                      <span className="text-2xl mb-1">{badge.icon}</span>
                      <div className="absolute -bottom-1 -right-1 bg-neon-green text-[8px] text-black font-black px-1 rounded-sm opacity-0 group-hover:opacity-100 transition-opacity">
                        {badge.points}
                      </div>
                    </div>
                  ))}
                {(gamificationData?.badges || []).filter(b => b.obtained).length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Aún no has ganado insignias.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Modo Alerta por Zonas */}
          <AlertZoneStatusSection />

          {/* Notificaciones */}
          <NotificationSettingsSection />

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
    </div >
  )
}
