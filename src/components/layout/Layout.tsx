import { Header } from './Header'
import { Footer } from './Footer'
import { ToastProvider } from '@/components/ui/toast'
import { BadgeNotificationManager } from '@/components/BadgeNotificationManager'

interface LayoutProps {
  children: React.ReactNode
}

export function Layout({ children }: LayoutProps) {
  return (
    <ToastProvider>
      <BadgeNotificationManager />
      <div className="flex min-h-screen flex-col bg-dark-bg">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
    </ToastProvider>
  )
}

