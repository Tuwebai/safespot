import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { usersApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { useToast } from '@/components/ui/toast'
import { handleError } from '@/lib/errorHandler'
import { TrendingUp, Calendar, FileText, ThumbsUp, Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PrefetchLink } from '@/components/PrefetchLink'
import { getAnonymousIdSafe } from '@/lib/identity'
import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar'
import type { UserProfile } from '@/lib/api'
import { ProfileSkeleton } from '@/components/ui/profile-skeleton'
// import { NotificationSettingsSection } from '@/components/NotificationSettingsSection' // Moved to SettingsPage
// import { AlertZoneStatusSection } from '@/components/AlertZoneStatusSection' // Moved to SettingsPage
import { useGamificationSummaryQuery } from '@/hooks/queries/useGamificationQuery'
import { Lock, ChevronRight, Award } from 'lucide-react'
import { calculateLevelProgress, getPointsToNextLevel } from '@/lib/levelCalculation'
import { useTheme } from '@/contexts/ThemeContext'
import { EditAliasModal } from '@/components/profile/EditAliasModal'
import { PencilIcon } from 'lucide-react'
import { queryKeys } from '@/lib/queryKeys'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'
import { useAuthStore } from '@/store/authStore'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { TrustHub } from '@/components/profile/TrustHub'

// ✅ PERFORMANCE FIX: Lazy load LoginModal (7 KB gzip) - only loads when user clicks "Guardar Progreso"
const LoginModal = lazy(() => import('@/components/auth/LoginModal').then(m => ({ default: m.LoginModal })))
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export function Perfil() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { } = useTheme()
  const navigate = useNavigate()
  const { checkAuth } = useAuthGuard()

  // 🛡️ PRE-AUTH GUARD: Check auth BEFORE navigating to form
  const handleCreateReport = () => {
    if (!checkAuth()) return;
    navigate('/crear-reporte');
  };

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
  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false)

  const { isAuthenticated, logout, user } = useAuthStore()

  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  const handleLogout = () => {
    // Trigger modal instead of window.confirm
    setIsLogoutModalOpen(true);
  }

  const confirmLogout = () => {
    localStorage.setItem('safespot_auth_logout', 'true');
    logout();
  }

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
        <Card className="bg-card border-border">
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
    <PullToRefresh
      onRefresh={async () => {
        await Promise.all([
          loadProfile(),
          queryClient.invalidateQueries({ queryKey: ['gamification'] })
        ])
      }}
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              <span className="gradient-text">
                {isAuthenticated ? 'Mi Perfil' : 'Perfil Anónimo'}
              </span>
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Tu actividad y logros en SafeSpot
            </p>
          </div>

          {!isAuthenticated ? (
            <Button
              onClick={() => setIsLoginModalOpen(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 animate-pulse"
            >
              <Lock className="w-4 h-4 mr-2" />
              Guardar Progreso
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <div className="text-right mr-2 flex flex-col items-end justify-center">
                <p className="text-xs text-muted-foreground hidden sm:block">
                  {user?.provider === 'google' ? 'Sesión iniciada con Google' : 'Sesión iniciada como'}
                </p>
                <div className="flex items-center justify-end gap-1.5 bg-white/5 sm:bg-transparent px-3 py-1.5 sm:p-0 rounded-full sm:rounded-none border border-white/10 sm:border-none">
                  {user?.provider === 'google' && (
                    <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-4 h-4" alt="Google" />
                  )}
                  <p className="text-xs sm:text-sm font-medium max-w-[140px] sm:max-w-none truncate">{user?.email}</p>
                </div>
              </div>

              {user?.provider !== 'google' && (
                <Button
                  variant="outline"
                  onClick={() => setIsChangePasswordModalOpen(true)}
                  className="border-gray-500/20 hover:bg-gray-500/10"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  Contraseña
                </Button>
              )}
              <Button
                variant="outline"
                onClick={handleLogout}
                className="border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-600"
              >
                Cerrar Sesión
              </Button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Columna Principal */}
          <div className="lg:col-span-2 space-y-6">


            {/* Información del Usuario */}
            <Card className="bg-card border-border card-glow">
              <CardHeader>
                <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                  <div className="relative group">
                    {/* Avatar Circle */}
                    <Avatar className="h-24 w-24 border-2 border-neon-green/30 group-hover:border-neon-green/80 transition-all shadow-[0_0_15px_rgba(0,255,136,0.1)]">
                      <AvatarImage
                        src={profile?.avatar_url || getAvatarUrl(anonymousId)}
                        alt="Avatar"
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-neon-green/10 text-neon-green text-3xl font-bold flex items-center justify-center">
                        {getAvatarFallback(anonymousId)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Actions Overlay / Buttons */}
                    <div className="absolute -bottom-2 -right-2 flex space-x-1">

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
                          className="h-8 w-8 rounded-full bg-card border-neon-green/50 hover:bg-neon-green hover:text-black transition-colors"
                          onClick={() => document.getElementById('avatar-upload')?.click()}
                          title="Subir imagen"
                        >
                          <span className="text-xs">📷</span>
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex-1">
                    <CardTitle className="text-xl sm:text-2xl flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className={profile?.alias ? "text-neon-green" : ""}>
                        {profile?.alias ? `@${profile.alias}` : 'Usuario Anónimo'}
                      </span>
                      {profile?.is_official && <VerifiedBadge size={20} className="text-blue-400" />}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded-full opacity-50 hover:opacity-100 hover:bg-white/10"
                        onClick={() => setIsAliasModalOpen(true)}
                        title="Editar Alias"
                      >
                        <PencilIcon className="h-3 w-3" />
                      </Button>

                      {profile?.avatar_url && (
                        <span className="text-[10px] bg-neon-green/20 text-neon-green px-2 py-0.5 rounded-full border border-neon-green/30">
                          Personalizado
                        </span>
                      )}
                    </CardTitle>
                    <CardDescription className="text-sm sm:text-base font-mono mt-1">
                      ID: {anonymousId}
                    </CardDescription>
                    {profile?.alias ? (
                      <Link to={`/usuario/${profile.alias}`} className="mt-2 inline-block">
                        <Button variant="outline" size="sm" className="text-xs h-7 bg-transparent border-neon-green/30 text-neon-green hover:bg-neon-green/10 hover:text-neon-green">
                          👤 Ver mi perfil público
                        </Button>
                      </Link>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-2 max-w-[300px] leading-tight mx-auto sm:mx-0">
                        Tu identidad permanece anónima. Configura un alias para ver tu perfil público.
                      </p>
                    )}
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
                          ).progressPercent}%`
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
                      ).progressPercent)}%</span>
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
            <Card className="bg-card border-border">
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
                    <Button onClick={handleCreateReport} variant="neon">Crear Primer Reporte</Button>
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
            {/* TrustHub: Centro de Transparencia */}
            <div className="mt-6">
              <TrustHub />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Actividad Reciente */}
            <Card className="bg-card border-border">
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

            {/* Configuración de Alertas (Enlace a nueva página) */}
            <Link to="/perfil/configuracion">
              <Card className="bg-card border-border hover:border-neon-green/50 transition-colors group cursor-pointer">
                <CardContent className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-neon-green/10 flex items-center justify-center text-neon-green">
                      <Bell size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold group-hover:text-neon-green transition-colors">Configuración General</h3>
                      <p className="text-sm text-muted-foreground">Zonas, notificaciones y más</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-neon-green transition-colors" />
                </CardContent>
              </Card>
            </Link>

            {/* CTA Crear Reporte */}
            <Card className="bg-card border-neon-green/20">
              <CardContent className="pt-6">
                <div className="text-center">
                  <h3 className="font-semibold mb-2">¿Viste un problema?</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Reporta problemas en tu ciudad
                  </p>
                  <Button onClick={handleCreateReport} variant="neon" className="w-full">
                    Crear Reporte
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div >

      <EditAliasModal
        isOpen={isAliasModalOpen}
        onClose={() => setIsAliasModalOpen(false)}
        currentAlias={profile?.alias}
        onSuccess={(newAlias) => {
          setProfile(prev => prev ? { ...prev, alias: newAlias } : null)
          // Invalidar query global para actualizar Header y otros componentes
          queryClient.invalidateQueries({ queryKey: queryKeys.user.profile })
        }}
      />

      {/* LoginModal - Lazy loaded */}
      {isLoginModalOpen && (
        <Suspense fallback={null}>
          <LoginModal
            isOpen={isLoginModalOpen}
            onClose={() => setIsLoginModalOpen(false)}
            initialMode="register"
          />
        </Suspense>
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      {/* NEW: Confirmation Modal for Logout */}
      <ConfirmationModal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        onConfirm={confirmLogout}
        title="¿Cerrar Sesión?"
        description="Si cierras sesión, volverás a usar el modo anónimo. Al iniciar sesión de nuevo, recuperarás tu progreso."
        confirmText="Sí, cerrar sesión"
        cancelText="Cancelar"
        variant="danger"
      />
    </PullToRefresh>
  )
}
