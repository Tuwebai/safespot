import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, ShieldAlert, Bell, Settings, LogOut, History, User, FileText, Menu, X, Activity, Shield, BarChart3 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { useEffect, useState, useRef } from 'react'
import { useAdminProfile } from '@/admin/hooks/useAdminProfile'
import { Z_INDEX } from '@/config/z-index'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function AdminLayout() {
    const location = useLocation()
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    
    // Mobile sidebar state
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const sidebarRef = useRef<HTMLElement>(null)

    // Fetch profile data from API to sync avatar
    const { data: profileData } = useAdminProfile()

    // Safe User Parsing from localStorage (initial state)
    const [adminUser, setAdminUser] = useState<{ alias?: string; email?: string; avatar_url?: string } | null>(() => {
        const userJson = localStorage.getItem('safespot_admin_user')
        try {
            return userJson ? JSON.parse(userJson) : null
        } catch (e) {
            console.error('Failed to parse admin user from storage', e)
            return null
        }
    })

    const [avatarError, setAvatarError] = useState(false)

    // Use ref to track last synced avatar_url to avoid dependency issues
    const lastSyncedAvatarUrl = useRef<string | undefined>(adminUser?.avatar_url)

    // Sync avatar from API when profile data loads
    useEffect(() => {
        if (profileData?.user) {
            const apiAvatarUrl = profileData.user.avatar_url

            // Only update if avatar_url actually changed
            if (lastSyncedAvatarUrl.current !== apiAvatarUrl) {
                lastSyncedAvatarUrl.current = apiAvatarUrl

                const updatedUser = {
                    alias: profileData.user.alias,
                    email: profileData.user.email,
                    avatar_url: apiAvatarUrl
                }

                localStorage.setItem('safespot_admin_user', JSON.stringify(updatedUser))
                setAdminUser(updatedUser)
                setAvatarError(false)
            }
        }
    }, [profileData])

    const adminAlias = adminUser?.alias || 'Admin'
    const adminEmail = adminUser?.email || ''
    const adminAvatarUrl = adminUser?.avatar_url

    // Sincronización entre tabs y componentes
    useEffect(() => {
        const handleStorageChange = () => {
            const userJson = localStorage.getItem('safespot_admin_user')
            try {
                const newUser = userJson ? JSON.parse(userJson) : null
                setAdminUser(newUser)
                setAvatarError(false) // Reset error on update
            } catch (e) {
                console.error('Failed to parse admin user from storage', e)
            }
        }

        // Listen to storage events (cross-tab)
        window.addEventListener('storage', handleStorageChange)

        return () => {
            window.removeEventListener('storage', handleStorageChange)
        }
    }, [])

    const navItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/admin/tasks', icon: Bell, label: 'Tareas' },
        { path: '/admin/users', icon: Users, label: 'Usuarios' },
        { path: '/admin/reports', icon: FileText, label: 'Reportes' },
        { path: '/admin/moderation', icon: ShieldAlert, label: 'Moderación' },
        { path: '/admin/history', icon: History, label: 'Historial' },
        { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
        { path: '/admin/audit', icon: Activity, label: 'Auditoría' },
    ]

    const handleLogout = () => {
        // 1. Clear Storage
        localStorage.removeItem('safespot_admin_token')
        localStorage.removeItem('safespot_admin_user')

        // 2. Clear Query Cache (Remove all sensitive data from memory)
        queryClient.clear()

        // 3. Force Redirect (Safe Context Reset)
        window.location.href = '/admin'
    }

    const handleSettings = () => {
        navigate('/admin/settings')
    }
    
    const handleSecurity = () => {
        navigate('/admin/security')
    }
    
    // Close mobile menu when route changes
    useEffect(() => {
        setIsMobileMenuOpen(false)
    }, [location.pathname])
    
    // Close mobile menu when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
                setIsMobileMenuOpen(false)
            }
        }
        
        if (isMobileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside)
            // Prevent body scroll when menu is open
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'unset'
        }
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
            document.body.style.overflow = 'unset'
        }
    }, [isMobileMenuOpen])

    return (
        <div className="min-h-screen bg-[#020617] text-white flex font-sans">
            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && (
                <div 
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm lg:hidden"
                    style={{ zIndex: Z_INDEX.DRAWER_BACKDROP }}
                    aria-hidden="true"
                />
            )}
            
            {/* Sidebar */}
            <aside 
                ref={sidebarRef}
                className={cn(
                    "border-r border-[#1e293b] flex flex-col fixed h-full bg-[#020617] transition-transform duration-300 ease-in-out",
                    "w-64 lg:translate-x-0",
                    isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
                )}
                style={{ zIndex: Z_INDEX.DRAWER_CONTENT }}
            >
                <div className="h-16 flex items-center justify-between px-6 border-b border-[#1e293b]">
                    <Link to="/" className="text-[#00ff88] font-bold text-xl tracking-wider flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <ShieldAlert className="h-5 w-5" />
                        SafeSpot <span className="text-[10px] bg-[#00ff88]/10 text-[#00ff88] px-1.5 py-0.5 rounded border border-[#00ff88]/20">ADMIN</span>
                    </Link>
                    {/* Close button for mobile */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="lg:hidden p-2 text-slate-400 hover:text-white hover:bg-[#1e293b] rounded-lg transition-colors"
                        aria-label="Cerrar menú"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const active = location.pathname.toLowerCase() === item.path.toLowerCase()
                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={cn(
                                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all group",
                                    active
                                        ? "bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20"
                                        : "text-slate-400 hover:text-white hover:bg-[#1e293b]"
                                )}
                            >
                                <Icon className={cn("h-4 w-4", active ? "text-[#00ff88]" : "text-slate-500 group-hover:text-white")} />
                                {item.label}
                            </Link>
                        )
                    })}
                </nav>

                <div className="p-4 border-t border-[#1e293b]">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2 w-full text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm"
                    >
                        <LogOut className="h-4 w-4" />
                        Terminar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 lg:ml-64 min-h-screen bg-[#020617]">
                {/* Top Header */}
                <header className="h-16 border-b border-[#1e293b] flex items-center justify-between px-4 lg:px-8 bg-[#020617]/80 backdrop-blur sticky top-0 z-10">
                    {/* Mobile Menu Button */}
                    <button
                        onClick={() => setIsMobileMenuOpen(true)}
                        className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-white hover:bg-[#1e293b] rounded-lg transition-colors"
                        aria-label="Abrir menú"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    
                    {/* Mobile Logo (centered) */}
                    <Link to="/admin" className="lg:hidden text-[#00ff88] font-bold text-lg tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="h-5 w-5" />
                        SafeSpot
                    </Link>
                    
                    <div className="hidden lg:flex items-center gap-4">
                        <span className="h-2 w-2 rounded-full bg-[#00ff88] animate-pulse"></span>
                        <span className="text-xs text-[#00ff88] font-mono tracking-widest">SYSTEM ONLINE</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="text-slate-400 hover:text-white relative cursor-not-allowed opacity-50" title="Notificaciones (Proximamente)">
                            <Bell className="h-5 w-5" />
                            {/* <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span> */}
                        </button>

                        <button
                            onClick={handleSettings}
                            className="text-slate-400 hover:text-white transition-colors"
                            title="Configuración"
                        >
                            <Settings className="h-5 w-5" />
                        </button>

                        <div className="pl-4 border-l border-[#334155]/50">
                            <DropdownMenu>
                                <DropdownMenuTrigger className="outline-none">
                                    {adminAvatarUrl && !avatarError ? (
                                        <img
                                            src={adminAvatarUrl}
                                            alt={adminAlias}
                                            className="h-9 w-9 rounded-full object-cover border border-[#334155] hover:border-[#00ff88]/50 transition-colors cursor-pointer"
                                            onError={() => setAvatarError(true)}
                                        />
                                    ) : (
                                        <div className="h-9 w-9 bg-[#1e293b] rounded-full flex items-center justify-center border border-[#334155] hover:border-[#00ff88]/50 transition-colors cursor-pointer group">
                                            <span className="text-xs font-bold text-white group-hover:text-[#00ff88]">
                                                {adminAlias.substring(0, 2).toUpperCase()}
                                            </span>
                                        </div>
                                    )}
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56 bg-[#0f172a] border-[#1e293b] text-slate-200">
                                    <DropdownMenuLabel>
                                        <div className="flex flex-col space-y-1">
                                            <p className="text-sm font-medium leading-none text-white">{adminAlias}</p>
                                            <p className="text-xs leading-none text-slate-500 truncate">{adminEmail}</p>
                                        </div>
                                    </DropdownMenuLabel>
                                    <DropdownMenuSeparator className="bg-[#1e293b]" />
                                    <DropdownMenuItem
                                        onClick={() => navigate('/admin/profile')}
                                        className="cursor-pointer focus:bg-[#1e293b] focus:text-[#00ff88]"
                                    >
                                        <User className="mr-2 h-4 w-4" />
                                        <span>Mi Perfil</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleSecurity}
                                        className="cursor-pointer focus:bg-[#1e293b] focus:text-[#00ff88]"
                                    >
                                        <Shield className="mr-2 h-4 w-4" />
                                        <span>Seguridad</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleSettings}
                                        className="cursor-pointer focus:bg-[#1e293b] focus:text-[#00ff88]"
                                    >
                                        <Settings className="mr-2 h-4 w-4" />
                                        <span>Configuración</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator className="bg-[#1e293b]" />
                                    <DropdownMenuItem
                                        onClick={handleLogout}
                                        className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                                    >
                                        <LogOut className="mr-2 h-4 w-4" />
                                        <span>Cerrar Sesión</span>
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    </div>
                </header>

                <div className="p-4 lg:p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
