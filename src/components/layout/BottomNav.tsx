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

/** MINIMUM TOUCH TARGET: 44x44px (WCAG 2.1 AA) */
const MIN_TOUCH_SIZE = 'min-h-[44px] min-w-[44px]'

export function BottomNav() {
    const location = useLocation()

    return (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50 safe-area-bottom">
            <div className="flex items-center h-14">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path
                    const Icon = item.icon

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            aria-current={isActive ? 'page' : undefined}
                            className={cn(
                                'flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-all duration-200',
                                'active:scale-95',
                                isActive
                                    ? 'text-neon-green'
                                    : 'text-foreground/60 hover:text-foreground active:text-neon-green/80'
                            )}
                        >
                            <div className={cn(
                                'flex items-center justify-center',
                                MIN_TOUCH_SIZE
                            )}>
                                <Icon
                                    className={cn(
                                        'h-5 w-5 transition-transform',
                                        isActive && 'scale-110'
                                    )}
                                    aria-hidden="true"
                                />
                            </div>
                            <span className={cn(
                                'text-[10px] font-medium transition-all truncate max-w-full px-1 leading-none -mt-0.5',
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
