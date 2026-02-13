/**
 * ============================================================================
 * BOTTOM NAVIGATION - Versión Corregida
 * ============================================================================
 * 
 * 🎯 Correcciones:
 * - Quitado botón Mensajes (ya está en Header global)
 * - Estructura: Inicio | Reportes | Crear (destacado) | Mapa | Perfil
 * - Layout estable con carruseles
 * 
 * 📱 Mobile-first: Safe areas, touch targets 44px
 */

import { Home, FileBarChart, Plus, Map, User } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'

interface NavItem {
    icon: typeof Home
    label: string
    path: string
    isCenter?: boolean
}

/** MINIMUM TOUCH TARGET: 44x44px (WCAG 2.1 AA) */
const MIN_TOUCH_SIZE = 'min-h-[44px] min-w-[44px]'

export function BottomNav() {
    const location = useLocation()
    const isActive = (path: string) => location.pathname === path

    const navItems: NavItem[] = [
        { 
            icon: Home, 
            label: 'Inicio', 
            path: '/',
        },
        { 
            icon: FileBarChart, 
            label: 'Reportes', 
            path: '/reportes',
        },
        { 
            icon: Plus, 
            label: 'Crear', 
            path: '/crear-reporte',
            isCenter: true,
        },
        { 
            icon: Map, 
            label: 'Mapa', 
            path: '/explorar',
        },
        { 
            icon: User, 
            label: 'Perfil', 
            path: '/perfil',
        },
    ]

    return (
        <nav 
            className="md:hidden fixed bottom-0 left-0 right-0 bg-background border-t border-border safe-area-bottom"
            style={{ zIndex: 25 }} // Por encima de LiveTicker (z-20) pero debajo de modales
        >
            <div className="flex items-center h-14 px-1">
                {navItems.map((item) => {
                    const active = isActive(item.path)
                    const Icon = item.icon
                    const isCenter = item.isCenter

                    // Botón central destacado (Crear)
                    if (isCenter) {
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className="flex flex-col items-center justify-center flex-1 h-full min-w-0"
                            >
                                <div className={cn(
                                    'flex items-center justify-center',
                                    'w-12 h-12 rounded-full',
                                    'bg-neon-green text-dark-bg',
                                    'shadow-lg shadow-neon-green/20',
                                    'transition-transform active:scale-95',
                                    'hover:bg-neon-green/90'
                                )}>
                                    <Plus className="h-6 w-6" />
                                </div>
                            </Link>
                        )
                    }

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                                'flex flex-col items-center justify-center flex-1 h-full min-w-0 transition-all duration-200',
                                'active:scale-95',
                                active
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
                                        active && 'scale-110'
                                    )}
                                    aria-hidden="true"
                                />
                            </div>
                            <span className={cn(
                                'text-[10px] font-medium transition-all truncate max-w-full px-1 leading-none -mt-0.5',
                                active && 'text-neon-green'
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
