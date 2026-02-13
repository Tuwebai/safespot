import { useState, Suspense } from 'react'
import { lazyRetry } from '@/lib/lazyRetry'
import { useQueryClient } from '@tanstack/react-query'

import { PullToRefresh } from '@/components/ui/PullToRefresh'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import { getAnonymousIdSafe } from '@/lib/identity'
import { ProfileSkeleton } from '@/components/ui/profile-skeleton'
import { useGamificationSummaryQuery } from '@/hooks/queries/useGamificationQuery'
import { useProfileQuery } from '@/hooks/queries/useProfileQuery'
import { ProfileHeader, ReportList, StatsCards, BadgesGrid, NextBadgeCard, ActivityTimeline, EditAliasModal, TrustHub } from '@/components/profile'
import { ChangePasswordModal } from '@/components/auth/ChangePasswordModal'
import { useAuthStore } from '@/store/authStore'

const LoginModal = lazyRetry(() => import('@/components/auth/LoginModal').then(m => ({ default: m.LoginModal })), 'LoginModal')
import { ConfirmationModal } from '@/components/ui/ConfirmationModal'
import { useAuthGuard } from '@/hooks/useAuthGuard'
import { useNavigate } from 'react-router-dom'

export function Perfil() {
  const queryClient = useQueryClient()
  // Theme hook available for future use
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

  const [isAliasModalOpen, setIsAliasModalOpen] = useState(false)
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false)
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false)

  const { isAuthenticated, logout } = useAuthStore()
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false)

  const handleLogout = () => setIsLogoutModalOpen(true);
  const confirmLogout = () => { localStorage.setItem('safespot_auth_logout', 'true'); logout(); }

  // 🏛️ SAFE MODE: Usar hook en lugar de API directa
  const { 
    data: profile, 
    isLoading: profileLoading, 
    error: profileError,
    refetch: refetchProfile 
  } = useProfileQuery()

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

  if (profileLoading || gamificationLoading) return <ProfileSkeleton />

  if ((profileError && gamificationError) || (!profile && !gamificationData)) {
    return (
      <div className="container mx-auto max-w-5xl px-4 py-8">
        <Card className="bg-card border-border">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{'Error al cargar perfil'}</p>
            <Button variant="outline" onClick={() => { refetchProfile(); refetchGamification(); }} className="mt-4">Reintentar</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const userReports = profile?.recent_reports || []
  const obtainedBadges = (gamificationData?.badges || []).filter(b => b.obtained)

  return (
    <PullToRefresh onRefresh={async () => { await Promise.all([refetchProfile(), queryClient.invalidateQueries({ queryKey: ['gamification'] })]) }}>
      <div className="container mx-auto max-w-5xl px-3 sm:px-4 lg:px-6 py-6 sm:py-8 overflow-x-hidden">
        
        {/* 🏛️ SAFE MODE: ProfileHeader extraído como componente independiente */}
        <ProfileHeader
          profile={profile ?? null}
          gamificationData={gamificationData}
          anonymousId={anonymousId}
          isAuthenticated={isAuthenticated}
          authProvider={profile?.provider}
          onEditAlias={() => setIsAliasModalOpen(true)}
          onLogin={() => setIsLoginModalOpen(true)}
          onSettings={() => navigate('/ajustes')}
          onPassword={() => setIsChangePasswordModalOpen(true)}
          onLogout={handleLogout}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMNA IZQUIERDA */}
          <div className="space-y-6">
            
            {/* 🏛️ SAFE MODE: ReportList extraído como componente independiente */}
            <ReportList 
              reports={userReports} 
              onCreateReport={handleCreateReport} 
            />

            {/* 🏛️ SAFE MODE: StatsCards extraído como componente independiente */}
            <StatsCards
              totalReports={gamificationData?.profile?.total_reports ?? profile?.total_reports ?? 0}
              totalVotes={gamificationData?.profile?.total_votes ?? profile?.total_votes ?? 0}
              totalComments={gamificationData?.profile?.total_comments ?? profile?.total_comments ?? 0}
            />

            {/* Centro de Transparencia - TrustHub */}
            <TrustHub />
          </div>

          {/* COLUMNA DERECHA */}
          <div className="space-y-6">
            
            {/* 🏛️ SAFE MODE: NextBadgeCard extraído como componente independiente */}
            {nextBadge && <NextBadgeCard badge={nextBadge} />}

            {/* 🏛️ SAFE MODE: BadgesGrid extraído como componente independiente */}
            <BadgesGrid badges={obtainedBadges} />

            {/* 🏛️ SAFE MODE: ActivityTimeline extraído como componente independiente */}
            <ActivityTimeline 
              recentReports={userReports.slice(0, 2)} 
              recentBadges={obtainedBadges.slice(-1)} 
            />

          </div>
        </div>
      </div>

      <EditAliasModal
        isOpen={isAliasModalOpen}
        onClose={() => setIsAliasModalOpen(false)}
        currentAlias={profile?.alias}
        onSuccess={() => { refetchProfile(); }}
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
