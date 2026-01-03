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
        <Header />
        <main id="main-content" className="flex-1 flex flex-col min-h-[60vh] bg-dark-bg pb-16 md:pb-0">
          <ErrorBoundary fallbackTitle="Ocurrió un error inesperado">
            <div className="flex-1 animate-in fade-in duration-500 fill-mode-both">
              {children}
            </div>
          </ErrorBoundary>
        </main>
        <Footer />
        <BottomNav />
      </div>
    </ToastProvider>
  )
}

