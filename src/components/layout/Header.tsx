import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Home, FileBarChart, MapPin, Trophy, Plus, User, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/NotificationBell'
import { BetaBadge } from '@/components/ui/BetaBadge'
import { useState, useEffect } from 'react'
import { useProfileQuery } from '@/hooks/queries/useProfileQuery'
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar"
import { getAnonymousIdSafe } from '@/lib/identity'

export function Header() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { data: profile } = useProfileQuery()
  const anonymousId = getAnonymousIdSafe()

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/reportes', label: 'Reportes', icon: FileBarChart },
    { path: '/favoritos', label: 'Favoritos', icon: Heart },
    { path: '/explorar', label: 'Mapa', icon: MapPin },
    { path: '/gamificacion', label: 'Gamificación', icon: Trophy },
  ]

  // Mobile Perf: Prefetch data when menu opens (user intent signal)
  useEffect(() => {
    if (mobileMenuOpen) {
      // Prefetch Reports
      queryClient.prefetchQuery({
        queryKey: ['reports', 'list'],
        queryFn: () => import('@/lib/api').then(m => m.reportsApi.getAll())
      })
      // Prefetch Gamification
      queryClient.prefetchQuery({
        queryKey: ['gamification', 'summary'],
        queryFn: () => import('@/lib/api').then(m => m.gamificationApi.getSummary())
      })
    }
  }, [mobileMenuOpen, queryClient])

  // Close menu on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false)
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [mobileMenuOpen])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-dark-border bg-dark-card">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-green to-green-400 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-dark-bg" />
            </div>
            <div className="text-xl font-bold gradient-text">SafeSpot</div>
            <BetaBadge className="ml-1" />
          </Link>

          {/* Navegación Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = isActive(item.path)
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onMouseEnter={() => {
                    // Prefetch data for "instant" feel
                    if (item.path === '/reportes' || item.path === '/explorar') {
                      queryClient.prefetchQuery({
                        queryKey: ['reports', 'list'],
                        queryFn: () => import('@/lib/api').then(m => m.reportsApi.getAll())
                      })
                    } else if (item.path === '/gamificacion') {
                      queryClient.prefetchQuery({
                        queryKey: ['gamification', 'summary'],
                        queryFn: () => import('@/lib/api').then(m => m.gamificationApi.getSummary())
                      })
                    }
                  }}
                >
                  <button
                    className={cn(
                      'text-sm font-medium px-3 py-2 rounded-md transition-colors',
                      active
                        ? 'text-neon-green bg-neon-green/10'
                        : 'text-foreground/70 hover:text-neon-green hover:bg-neon-green/5'
                    )}
                  >
                    <Icon className="inline-block mr-2 h-4 w-4" />
                    {item.label}
                  </button>
                </Link>
              )
            })}
          </nav>

          {/* Notification Bell and Create Report Button */}
          <div className="hidden md:flex items-center space-x-4">
            <NotificationBell />
            <Link to="/perfil">
              <div className={cn(
                "flex items-center justify-center h-9 w-9 rounded-full border transition-all hover:bg-neon-green/10 cursor-pointer overflow-hidden",
                isActive('/perfil')
                  ? "border-neon-green bg-neon-green/10"
                  : "border-transparent hover:border-neon-green/50"
              )}
                aria-label="Ver mi perfil y logros"
                title="Mi Perfil"
              >
                <Avatar className="h-full w-full">
                  <AvatarImage
                    src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${anonymousId}`}
                    alt="Avatar"
                    className="object-cover"
                  />
                  <AvatarFallback className="bg-transparent text-foreground/70">
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
              </div>
            </Link>
            <Link to="/crear-reporte">
              <Button
                className="neon-glow bg-neon-green hover:bg-neon-green/90 text-dark-bg transition-all active:scale-95"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear Reporte
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center space-x-4">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-foreground/70 hover:text-neon-green transition-colors"
              aria-label={mobileMenuOpen ? "Cerrar menú principal" : "Abrir menú principal"}
            >
              <div className="hamburger-icon" aria-hidden="true">
                <span className={cn("hamburger-line", mobileMenuOpen && "open")} />
                <span className={cn("hamburger-line", mobileMenuOpen && "open")} />
                <span className={cn("hamburger-line", mobileMenuOpen && "open")} />
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden animate-in fade-in duration-300"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 right-0 w-[85vw] max-w-[320px] bg-dark-card border-l border-dark-border z-[100] md:hidden shadow-2xl safe-area-bottom",
          "transform transition-transform duration-300 ease-in-out",
          mobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}
        onTouchStart={(e) => {
          const touch = e.touches[0]
          // @ts-ignore
          e.currentTarget.dataset.startX = touch.clientX.toString()
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0]
          // @ts-ignore
          const startX = parseFloat(e.currentTarget.dataset.startX || '0')
          const currentX = touch.clientX
          const diff = currentX - startX

          // If swiping right (diff > 0) significantly, we could animate/close
          if (diff > 50) {
            setMobileMenuOpen(false)
          }
        }}
      >
        {/* Drawer Header */}
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-r from-neon-green to-green-400 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-dark-bg" />
            </div>
            <div className="text-lg font-bold gradient-text">SafeSpot</div>
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-2 text-foreground/70 hover:text-neon-green transition-colors"
          >
            <div className="hamburger-icon">
              <span className="hamburger-line open" />
              <span className="hamburger-line open" />
              <span className="hamburger-line open" />
            </div>
          </button>
        </div>

        {/* Drawer Content */}
        <nav className="flex flex-col p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center px-4 py-3 rounded-lg transition-all duration-200',
                  'active:scale-95',
                  active
                    ? 'text-neon-green bg-neon-green/10'
                    : 'text-foreground/70 hover:text-neon-green hover:bg-neon-green/5'
                )}
              >
                <Icon className="mr-3 h-5 w-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}

          <div className="pt-4 mt-4 border-t border-dark-border">
            <Link
              to="/perfil"
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                'flex items-center px-4 py-3 rounded-lg transition-all duration-200',
                'active:scale-95',
                isActive('/perfil')
                  ? 'text-neon-green bg-neon-green/10'
                  : 'text-foreground/70 hover:text-neon-green hover:bg-neon-green/5'
              )}
            >
              <div className="mr-3 h-8 w-8 rounded-full border border-dark-border overflow-hidden">
                <Avatar className="h-full w-full">
                  <AvatarImage
                    src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${anonymousId}`}
                    alt="Avatar"
                  />
                  <AvatarFallback className="bg-transparent">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <span className="font-medium">Mi Perfil y Logros</span>
            </Link>
          </div>

          <Link
            to="/crear-reporte"
            onClick={() => setMobileMenuOpen(false)}
            className="mt-4"
          >
            <Button
              className="w-full neon-glow bg-neon-green hover:bg-neon-green/90 text-dark-bg py-6"
            >
              <Plus className="mr-2 h-5 w-5" />
              Crear Reporte
            </Button>
          </Link>
        </nav>
      </div>
    </header>
  )
}
