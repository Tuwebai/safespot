import { Header } from './Header'
import { Footer } from './Footer'
import { BottomNav } from './BottomNav'
// ToastProvider removed (moved to App.tsx)
import { BadgeNotificationManager } from '@/components/BadgeNotificationManager'
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { ErrorBoundary } from '../ErrorBoundary'
import { useLocation } from 'react-router-dom'
import { useProfileQuery, useInvalidateProfile } from '@/hooks/queries/useProfileQuery'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { useUserNotifications } from '@/hooks/useUserNotifications'
import { useGlobalFeed } from '@/hooks/useGlobalFeed'
import { usePresenceHeartbeat } from '@/hooks/usePresenceHeartbeat'
import { useGlobalRealtime } from '@/hooks/useGlobalRealtime'
// import { AdModal } from '@/components/ads/AdModal'
import { EditAliasModal } from '@/components/profile/EditAliasModal'
import { ServiceWorkerController } from '@/components/ServiceWorkerController'
import { cn } from '@/lib/utils'

import { NotificationFeedbackListener } from '@/components/notifications/NotificationFeedbackListener'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  // Enable deterministic scroll restoration
  useScrollRestoration()

  const location = useLocation()
  const { data: profile, isLoading } = useProfileQuery()
  const { invalidateProfile } = useInvalidateProfile()
  const queryClient = useQueryClient()

  // Global Real-time Notifications Listener
  // This ensures that wherever the user is, they receive updates for follows, etc.
  useUserNotifications()
  useGlobalFeed() // Listen for home feed updates (likes counters)
  usePresenceHeartbeat() // Keep user "Online" in Redis
  useGlobalRealtime(profile?.id) // ✅ ENTERPRISE REALTIME: Always-on connection

  // Routes where alias is not enforced
  const publicRoutes = ['/terminos', '/privacidad']
  const isPublicRoute = publicRoutes.includes(location.pathname)
  const isMensajesPage = location.pathname.includes('/mensajes')
  const isAdminPage = location.pathname.toLowerCase().startsWith('/admin')

  // Determine if we should force alias creation
  // Condición: No está cargando, tenemos perfil, NO tiene alias, y NO es una ruta pública, Y NO es admin
  const showForceAlias = !isLoading && profile && !profile.alias && !isPublicRoute && !isAdminPage

  return (
    <>
      <ServiceWorkerController />
      <NotificationFeedbackListener />
      {/* <AdModal /> */}
      <BadgeNotificationManager />
      <NetworkStatusIndicator />

      {/* Forced Alias Modal */}
      <EditAliasModal
        isOpen={!!showForceAlias}
        onClose={() => { }} // No-op, forced mode handles this
        currentAlias=""
        onSuccess={(newAlias) => {
          // Optimistic Update: Update cache immediately to close modal instantly
          queryClient.setQueryData(queryKeys.user.profile, (old: any) => {
            if (!old) return old;
            return { ...old, alias: newAlias };
          });
          // Then invalidate to ensure full consistency (e.g. badges, next level info if changed)
          invalidateProfile()
        }}
        isForced={true}
      />

      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <div className={cn(
        "flex min-h-screen flex-col bg-dark-bg text-white selection:bg-neon-green/30",
        isAdminPage && "min-h-0 h-full"
      )}>
        {!isMensajesPage && !isAdminPage && <Header />}
        <main
          id="main-content"
          className={cn(
            "flex-1 flex flex-col bg-dark-bg",
            isMensajesPage
              ? "fixed inset-0 z-[60] h-screen w-screen overflow-hidden p-0 m-0 max-w-none"
              : isAdminPage
                ? "w-full min-h-screen p-0 m-0"
                : "min-h-[60vh] pb-16 md:pb-0"
          )}
        >
          <ErrorBoundary fallbackTitle="Ocurrió un error inesperado">
            <div className={cn(
              "flex-1 animate-in fade-in duration-500 fill-mode-both",
              (isMensajesPage || isAdminPage) && "h-full w-full max-w-none p-0 m-0"
            )}>
              {children}
            </div>
          </ErrorBoundary>
        </main>
        {!isMensajesPage && !isAdminPage && <Footer />}
        {!isMensajesPage && !isAdminPage && <BottomNav />}
      </div>
    </>
  )
}
