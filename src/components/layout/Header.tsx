import { Link, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Home, FileBarChart, MapPin, Trophy, Plus, Menu, X, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { NotificationBell } from '@/components/NotificationBell'
import { BetaBadge } from '@/components/ui/BetaBadge'
import { useState } from 'react'

export function Header() {
  const location = useLocation()
  const queryClient = useQueryClient()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const isActive = (path: string) => location.pathname === path

  const navItems = [
    { path: '/', label: 'Inicio', icon: Home },
    { path: '/reportes', label: 'Reportes', icon: FileBarChart },
    { path: '/favoritos', label: 'Favoritos', icon: Heart },
    { path: '/explorar', label: 'Mapa', icon: MapPin },
    { path: '/gamificacion', label: 'Gamificación', icon: Trophy },
  ]

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
                        queryKey: ['reports', 'all'],
                        queryFn: () => import('@/lib/api').then(m => m.reportsApi.getAll())
                      })
                    } else if (item.path === '/gamificacion') {
                      queryClient.prefetchQuery({
                        queryKey: ['badges', 'progress'],
                        queryFn: () => import('@/lib/api').then(m => m.badgesApi.getProgress())
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
            <Link to="/crear-reporte">
              <Button
                className="neon-glow bg-neon-green hover:bg-neon-green/90 text-dark-bg"
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear Reporte
              </Button>
            </Link>
          </div>

          {/* Menú Móvil */}
          <div className="flex md:hidden items-center space-x-4">
            <NotificationBell />
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-foreground/70 hover:text-neon-green"
            >
              {mobileMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Menú Móvil Desplegable */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-dark-border py-4">
            <nav className="flex flex-col space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'text-sm font-medium px-3 py-2 rounded-md transition-colors flex items-center',
                      active
                        ? 'text-neon-green bg-neon-green/10'
                        : 'text-foreground/70 hover:text-neon-green hover:bg-neon-green/5'
                    )}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    {item.label}
                  </Link>
                )
              })}
              <Link
                to="/crear-reporte"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-4"
              >
                <Button
                  className="w-full neon-glow bg-neon-green hover:bg-neon-green/90 text-dark-bg"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Crear Reporte
                </Button>
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
