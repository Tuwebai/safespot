import { Home, MapPin, Plus, Map, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NavItem {
    icon: typeof Home
    label: string
    path: string
}

const navItems: NavItem[] = [
    { icon: Home, label: 'Inicio', path: '/' },
    { icon: MapPin, label: 'Reportes', path: '/reportes' },
    { icon: Plus, label: 'Crear', path: '/crear-reporte' },
    { icon: Map, label: 'Mapa', path: '/explorar' },
    { icon: User, label: 'Perfil', path: '/perfil' },
]


export function BottomNav() {
    const location = useLocation()

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-bottom">
            <div className="flex justify-around items-center h-16">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex flex-col items-center justify-center flex-1 h-full transition-all duration-200',
                                'active:scale-95',
                                isActive
                                    ? 'text-neon-green'
                                    : 'text-foreground/60 hover:text-foreground active:text-neon-green/80'
                            )}
                        >
                            <Icon
                                className={cn(
                                    'h-6 w-6 transition-transform',
                                    isActive && 'scale-110'
                                )}
                                aria-hidden="true"
                            />
                            <span className={cn(
                                'text-xs mt-1 font-medium transition-all',
                                isActive && 'text-neon-green'
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    )
}
