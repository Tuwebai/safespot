import { Header } from './Header'
import { Footer } from './Footer'
import { BottomNav } from './BottomNav'
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
      <div className="flex min-h-screen flex-col bg-dark-bg text-white selection:bg-neon-green/30">
        <Header />
        <main className="flex-1 flex flex-col min-h-[60vh] bg-dark-bg pb-16 md:pb-0">
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

