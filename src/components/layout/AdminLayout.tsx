import { Link, Outlet, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, ShieldAlert, Bell, Settings, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

export function AdminLayout() {
    const location = useLocation()

    const navItems = [
        { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/admin/users', icon: Users, label: 'Users' },
        { path: '/admin/moderation', icon: ShieldAlert, label: 'Moderation' },
    ]

    const handleLogout = () => {
        localStorage.removeItem('safespot_admin_token')
        localStorage.removeItem('safespot_admin_user')
        window.location.href = '/admin'
    }

    return (
        <div className="min-h-screen bg-[#020617] text-white flex font-sans">
            {/* Sidebar */}
            <aside className="w-64 border-r border-[#1e293b] flex flex-col fixed h-full bg-[#020617] z-20">
                <div className="h-16 flex items-center px-6 border-b border-[#1e293b]">
                    <Link to="/" className="text-[#00ff88] font-bold text-xl tracking-wider flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <ShieldAlert className="h-5 w-5" />
                        SafeSpot <span className="text-[10px] bg-[#00ff88]/10 text-[#00ff88] px-1.5 py-0.5 rounded border border-[#00ff88]/20">ADMIN</span>
                    </Link>
                </div>

                <nav className="flex-1 p-4 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const active = location.pathname === item.path
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
            <main className="flex-1 ml-64 min-h-screen bg-[#020617]">
                {/* Top Header */}
                <header className="h-16 border-b border-[#1e293b] flex items-center justify-between px-8 bg-[#020617]/80 backdrop-blur sticky top-0 z-10">
                    <div className="flex items-center gap-4">
                        <span className="h-2 w-2 rounded-full bg-[#00ff88] animate-pulse"></span>
                        <span className="text-xs text-[#00ff88] font-mono tracking-widest">SYSTEM ONLINE</span>
                    </div>

                    <div className="flex items-center gap-6">
                        <button className="text-slate-400 hover:text-white relative">
                            <Bell className="h-5 w-5" />
                            <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full"></span>
                        </button>
                        <button className="text-slate-400 hover:text-white">
                            <Settings className="h-5 w-5" />
                        </button>
                        <div className="h-8 w-8 bg-[#1e293b] rounded-full flex items-center justify-center border border-[#334155]">
                            <span className="text-xs font-bold text-white">AD</span>
                        </div>
                    </div>
                </header>

                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    )
}
