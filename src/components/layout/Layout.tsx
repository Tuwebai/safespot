import { Header } from './Header'
import { Footer } from './Footer'
import { BottomNav } from './BottomNav'
import { ToastProvider } from '@/components/ui/toast'
import { BadgeNotificationManager } from '@/components/BadgeNotificationManager'
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { ErrorBoundary } from '../ErrorBoundary'
import { useLocation } from 'react-router-dom'
import { useProfileQuery, useInvalidateProfile } from '@/hooks/queries/useProfileQuery'
import { EditAliasModal } from '@/components/profile/EditAliasModal'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  // Enable deterministic scroll restoration
  useScrollRestoration()

  const location = useLocation()
  const { data: profile, isLoading } = useProfileQuery()
  const { invalidateProfile } = useInvalidateProfile()

  // Routes where alias is not enforced
  const publicRoutes = ['/terminos', '/privacidad']
  const isPublicRoute = publicRoutes.includes(location.pathname)
  const isMensajesPage = location.pathname.includes('/mensajes')

  // Determine if we should force alias creation
  // Condición: No está cargando, tenemos perfil, NO tiene alias, y NO es una ruta pública
  const showForceAlias = !isLoading && profile && !profile.alias && !isPublicRoute

  return (
    <ToastProvider>
      <BadgeNotificationManager />
      <NetworkStatusIndicator />

      {/* Forced Alias Modal */}
      <EditAliasModal
        isOpen={!!showForceAlias}
        onClose={() => { }} // No-op, forced mode handles this
        currentAlias=""
        onSuccess={() => {
          invalidateProfile()
        }}
        isForced={true}
      />

      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>
      <div className="flex min-h-screen flex-col bg-dark-bg text-white selection:bg-neon-green/30">
        {!isMensajesPage && <Header />}
        <main
          id="main-content"
          className={cn(
            "flex-1 flex flex-col bg-dark-bg",
            isMensajesPage
              ? "fixed inset-0 z-[60] h-screen w-screen overflow-hidden p-0 m-0 max-w-none"
              : "min-h-[60vh] pb-16 md:pb-0 overflow-hidden"
          )}
        >
          <ErrorBoundary fallbackTitle="Ocurrió un error inesperado">
            <div className={cn(
              "flex-1 animate-in fade-in duration-500 fill-mode-both",
              isMensajesPage && "h-full w-full max-w-none p-0 m-0"
            )}>
              {children}
            </div>
          </ErrorBoundary>
        </main>
        {!isMensajesPage && <Footer />}
        {!isMensajesPage && <BottomNav />}
      </div>
    </ToastProvider>
  )
}
