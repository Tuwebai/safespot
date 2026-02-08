import { useState, useEffect, useCallback, lazy, Suspense } from 'react'
import { usersApi } from '@/lib/api'
import { useQueryClient } from '@tanstack/react-query'

import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { useToast } from '@/components/ui/toast'
import { handleError } from '@/lib/errorHandler'
import { 
  Calendar, 
  FileText, 
  ThumbsUp, 
  Plus,
  Award,
  MapPin,
  ChevronRight,
  Settings,
  LogOut,
  Activity
} from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PrefetchLink } from '@/components/PrefetchLink'
import { getAnonymousIdSafe } from '@/lib/identity'
import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar'
import type { UserProfile } from '@/lib/api'
import { ProfileSkeleton } from '@/components/ui/profile-skeleton'
import { useGamificationSummaryQuery } from '@/hooks/queries/useGamificationQuery'
import { Lock, PencilIcon } from 'lucide-react'
import { calculateLevelProgress, getPointsToNextLevel } from '@/lib/levelCalculation'
import { useTheme } from '@/contexts/ThemeContext'
import { EditAliasModal } from '@/components/profile/EditAliasModal'
import { queryKeys } from '@/lib/queryKeys'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'
import { useAuthStore } from '@/store/authStore'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { TrustHub } from '@/components/profile/TrustHub'

const LoginModal = lazy(() => import('@/components/auth/LoginModal').then(m => ({ default: m.LoginModal })))
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export function Perfil() {
  const toast = useToast()
  const queryClient = useQueryClient()
  const { } = useTheme()
  const navigate = useNavigate()
  const { checkAuth } = useAuthGuard()

  const handleCreateReport = () => {
    if (!checkAuth()) return;
    navigate('/crear-reporte');
  };

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

  const { isAuthenticated, logout } = useAuthStore()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)
  const [showAllBadges, setShowAllBadges] = useState(false)
  const [showAllReports, setShowAllReports] = useState(false)

  const handleLogout = () => setIsLogoutModalOpen(true);
  const confirmLogout = () => { localStorage.setItem('safespot_auth_logout', 'true'); logout(); }

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

  useEffect(() => { loadProfile() }, [loadProfile])

  const getNextBadgeData = () => {
    if (!gamificationData?.badges) return null
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

  if (loading || gamificationLoading) return <ProfileSkeleton />

  if ((error && gamificationError) || (!profile && !gamificationData)) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error || 'Error al cargar perfil'}</p>
            <Button variant="outline" onClick={() => { loadProfile(); refetchGamification(); }} className="mt-4">Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userReports = profile?.recent_reports || []
  const obtainedBadges = (gamificationData?.badges || []).filter(b => b.obtained)
  const currentLevel = gamificationData?.profile?.level ?? profile?.level ?? 1
  const currentPoints = gamificationData?.profile?.points ?? profile?.points ?? 0

  return (
    <PullToRefresh onRefresh={async () => { await Promise.all([loadProfile(), queryClient.invalidateQueries({ queryKey: ['gamification'] })]) }}>
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 lg:px-6 py-4 sm:py-6 overflow-x-hidden">
        
        {/* HEADER CONSOLIDADO: Avatar + Nombre + Nivel + Barra de progreso */}
        <div className="mb-4 sm:mb-6">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <Avatar className="h-12 w-12 sm:h-16 sm:w-16 border-2 border-neon-green/30 shadow-[0_0_15px_rgba(0,255,136,0.1)] shrink-0">
                <AvatarImage src={profile?.avatarUrl || getAvatarUrl(anonymousId)} alt="Avatar" className="object-cover" />
                <AvatarFallback className="bg-neon-green/10 text-neon-green text-xl font-bold">{getAvatarFallback(anonymousId)}</AvatarFallback>
              </Avatar>
              
              <div>
                <div className="flex items-center gap-2">
                  <h1 className={`text-xl font-bold ${profile?.alias ? "text-neon-green" : "text-foreground"}`}>
                    {profile?.alias ? `@${profile.alias}` : 'Usuario Anónimo'}
                  </h1>
                  {profile?.is_official && <VerifiedBadge size={16} className="text-blue-400" />}
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-50 hover:opacity-100" onClick={() => setIsAliasModalOpen(true)}>
                    <PencilIcon className="h-3 w-3" />
                  </Button>
                </div>
                
                <div className="flex items-center gap-3 mt-1">
                  <Badge variant="outline" className="text-xs bg-neon-green/10 border-neon-green/30 text-neon-green">
                    Nivel {currentLevel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{currentPoints} pts</span>
                  {profile?.alias && (
                    <Link to={`/usuario/${profile.alias}`} className="text-[10px] text-neon-green hover:underline">Ver perfil público →</Link>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2">
              {!isAuthenticated ? (
                <Button onClick={() => setIsLoginModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 animate-pulse" size="sm">
                  <Lock className="w-4 h-4 mr-1 sm:mr-2" />
                  <span className="hidden sm:inline">Guardar Progreso</span>
                  <span className="sm:hidden">Guardar</span>
                </Button>
              ) : (
                <>
                  <Button variant="ghost" size="icon" onClick={() => navigate('/perfil/configuracion')} className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-10 sm:w-10" title="Configuración">
                    <Settings className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                  {profile?.provider !== 'google' && (
                    <Button variant="ghost" size="icon" onClick={() => setIsChangePasswordModalOpen(true)} className="text-muted-foreground hover:text-foreground h-8 w-8 sm:h-10 sm:w-10" title="Cambiar Contraseña">
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive h-8 w-8 sm:h-10 sm:w-10" title="Cerrar Sesión">
                    <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                  </Button>
                </>
              )}
            </div>
          </div>
          
          {/* Barra de progreso simplificada */}
          <div className="mt-4">
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="text-muted-foreground">{getPointsToNextLevel(currentPoints, currentLevel)} pts para Nivel {currentLevel + 1}</span>
              <span className="text-neon-green font-bold">{Math.round(calculateLevelProgress(currentPoints, currentLevel).progressPercent)}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-gradient-to-r from-neon-green to-emerald-400 h-full rounded-full transition-all duration-1000" 
                style={{ width: `${calculateLevelProgress(currentPoints, currentLevel).progressPercent}%` }} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-6">
            
            {/* MIS REPORTES */}
            <Card className="bg-card border-border">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4" />
                  Mis Reportes
                  {userReports.length > 0 && <Badge variant="secondary" className="text-xs">{userReports.length}</Badge>}
                </CardTitle>
                {userReports.length > 0 && (
                  <Button onClick={handleCreateReport} variant="neon" size="sm" className="h-8">
                    <Plus className="w-4 h-4 mr-1" />
                    Crear
                  </Button>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {userReports.length === 0 ? (
                  <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 py-4 px-2 text-center sm:text-left">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
                      <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/40" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">Tu voz importa</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
                        Contanos qué pasó en tu zona. Tu primer reporte ayuda a todos.
                      </p>
                    </div>
                    <Button onClick={handleCreateReport} variant="neon" size="sm" className="w-full sm:w-auto mt-2 sm:mt-0">
                      Crear
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className={`space-y-2 ${showAllReports ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
                      {(showAllReports ? userReports : userReports.slice(0, 3)).map((report) => (
                        <PrefetchLink key={report.id} to={`/reporte/${report.id}`} prefetchRoute="DetalleReporte" prefetchReportId={report.id}>
                          <div className="p-3 rounded-lg bg-muted/30 border border-border hover:border-neon-green/50 hover:bg-muted/50 transition-all group cursor-pointer">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-medium text-sm line-clamp-1 group-hover:text-neon-green transition-colors">{report.title}</h3>
                                <div className="flex items-center gap-3 mt-1.5">
                                  <Badge variant="outline" className="text-[10px] h-4 px-1">{report.status}</Badge>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    {new Date(report.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                  </span>
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <ThumbsUp className="h-3 w-3" />
                                    {report.upvotes_count}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-neon-green transition-colors shrink-0 mt-0.5" />
                            </div>
                          </div>
                        </PrefetchLink>
                      ))}
                    </div>
                    {userReports.length > 3 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-3 text-xs text-muted-foreground hover:text-neon-green"
                        onClick={() => setShowAllReports(!showAllReports)}
                      >
                        {showAllReports ? (
                          <>Ver menos <ChevronRight className="h-3 w-3 ml-1 rotate-180" /></>
                        ) : (
                          <>Ver más ({userReports.length - 3}) <ChevronRight className="h-3 w-3 ml-1" /></>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ESTADÍSTICAS - Movidas desde la derecha */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="text-center p-3 sm:p-4 rounded-lg bg-card border border-border min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-neon-green">{gamificationData?.profile?.total_reports ?? profile?.total_reports}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-tighter mt-1 truncate">Reportes</div>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg bg-card border border-border min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-neon-green">{gamificationData?.profile?.total_votes ?? profile?.total_votes}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-tighter mt-1 truncate">Apoyos</div>
              </div>
              <div className="text-center p-3 sm:p-4 rounded-lg bg-card border border-border min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-neon-green">{gamificationData?.profile?.total_comments ?? profile?.total_comments}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-tighter mt-1 truncate">Coment.</div>
              </div>
            </div>

            {/* Centro de Transparencia - TrustHub */}
            <TrustHub />
          </div>

          {/* COLUMNA DERECHA */}
          <div className="space-y-6">
            
            {/* PRÓXIMO LOGRO - Primero (meta actual) */}
            {nextBadge && (
              <Card className="bg-card border-border min-h-[120px]">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground font-bold">
                    <Award className="h-3 w-3" />
                    Próximo Logro
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center shrink-0">
                      <span className="text-lg grayscale opacity-50">{nextBadge.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold truncate">{nextBadge.name}</h4>
                      <div className="w-full bg-muted rounded-full h-1.5 mt-1.5">
                        <div className="bg-neon-green h-full rounded-full transition-all duration-1000" style={{ width: `${nextBadge.progress.required ? (nextBadge.progress.current / nextBadge.progress.required) * 100 : 0}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{nextBadge.progress.current} / {nextBadge.progress.required}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* INSIGNIAS - Expandible (historial de logros) */}
            <Card className={`bg-card border-border transition-all duration-300 min-h-[140px] ${showAllBadges ? 'row-span-2' : ''}`}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    Insignias
                  </div>
                  {obtainedBadges.length > 0 && (
                    <span className="text-xs text-muted-foreground font-normal">{obtainedBadges.length} obtenidas</span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {obtainedBadges.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Completa misiones para ganar insignias</p>
                ) : (
                  <>
                    <div className={`grid grid-cols-4 gap-2 ${showAllBadges ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
                      {(showAllBadges ? obtainedBadges : obtainedBadges.slice(0, 4)).map(badge => (
                        <div key={badge.id} className="aspect-square bg-neon-green/10 border border-neon-green/20 rounded-lg flex items-center justify-center relative group cursor-pointer hover:bg-neon-green/20 transition-colors" title={`${badge.name} - ${badge.points} pts`}>
                          <span className="text-xl">{badge.icon}</span>
                          <div className="absolute -bottom-1 -right-1 bg-neon-green text-[8px] text-black font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">{badge.points}</div>
                        </div>
                      ))}
                    </div>
                    {obtainedBadges.length > 4 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-3 text-xs text-muted-foreground hover:text-neon-green"
                        onClick={() => setShowAllBadges(!showAllBadges)}
                      >
                        {showAllBadges ? (
                          <>Ver menos <ChevronRight className="h-3 w-3 ml-1 rotate-180" /></>
                        ) : (
                          <>Ver todas ({obtainedBadges.length}) <ChevronRight className="h-3 w-3 ml-1" /></>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* ACTIVIDAD RECIENTE - Timeline */}
            <Card className="bg-card border-border min-h-[120px]">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4" />
                  Actividad Reciente
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {userReports.length > 0 ? (
                    <>
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 rounded-full bg-neon-green mt-1.5 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs">Creaste un reporte</p>
                          <p className="text-[10px] text-muted-foreground">{userReports[0]?.title}</p>
                        </div>
                      </div>
                      {userReports[1] && (
                        <div className="flex items-start gap-3">
                          <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mt-1.5 shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs">Creaste un reporte</p>
                            <p className="text-[10px] text-muted-foreground">{userReports[1]?.title}</p>
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">Sin actividad reciente</p>
                  )}
                  {obtainedBadges.length > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs">Ganaste insignia</p>
                        <p className="text-[10px] text-muted-foreground">{obtainedBadges[obtainedBadges.length - 1]?.name}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      <EditAliasModal
        isOpen={isAliasModalOpen}
        onClose={() => setIsAliasModalOpen(false)}
        currentAlias={profile?.alias}
        onSuccess={(newAlias) => { setProfile(prev => prev ? { ...prev, alias: newAlias } : null); queryClient.invalidateQueries({ queryKey: queryKeys.user.profile }) }}
      />

      {isLoginModalOpen && (
        <Suspense fallback={null}>
          <LoginModal isOpen={isLoginModalOpen} onClose={() => setIsLoginModalOpen(false)} initialMode="register" />
        </Suspense>
      )}

      <ChangePasswordModal isOpen={isChangePasswordModalOpen} onClose={() => setIsChangePasswordModalOpen(false)} />

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
