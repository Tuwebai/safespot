import { Header } from './Header'
import { Footer } from './Footer'
import { ToastProvider } from '@/components/ui/toast'
import { BadgeNotificationManager } from '@/components/BadgeNotificationManager'
import { NetworkStatusIndicator } from '@/components/NetworkStatusIndicator'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { ErrorBoundary } from '../ErrorBoundary'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  // Enable deterministic scroll restoration
  useScrollRestoration()

  return (
    <ToastProvider>
      <BadgeNotificationManager />
      <NetworkStatusIndicator />
      <div className="flex min-h-screen flex-col bg-dark-bg text-white">
        <Header />
        <main className="flex-1">
          <ErrorBoundary fallbackTitle="Ocurrió un error inesperado">
            {children}
          </ErrorBoundary>
        </main>
        <Footer />
      </div>
    </ToastProvider>
  )
}

