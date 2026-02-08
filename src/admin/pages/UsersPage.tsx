import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { adminApi } from '../services/adminApi'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Search,
    Ban,
    UserCheck,
    Loader2,
    Award,
    Calendar,
    MessageSquare,
    FileText,
    Shield,
    Activity
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { getAvatarUrl } from '@/lib/avatar'
import { useConfirm } from '@/components/ui/useConfirm'
import { useToast } from '@/components/ui/toast/useToast'

interface AdminUser {
    anonymous_id: string
    alias: string | null
    avatar_url: string | null
    created_at: string
    last_active_at: string
    total_reports: number
    total_comments: number
    trust_score: number
    status: 'active' | 'banned' | 'shadow_banned'
    level: number
    points: number
}

interface UsersResponse {
    users: AdminUser[]
    meta: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

export function UsersPage() {
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [hoveredUser, setHoveredUser] = useState<{ user: AdminUser, x: number, y: number } | null>(null)
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const debouncedSearch = useDebounce(search, 500)
    const { confirm } = useConfirm()
    const { error: showError } = useToast()

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
        }
    }, [])

    const queryClient = useQueryClient()

    // Query Users
    const { data, isLoading } = useQuery<UsersResponse>({
        queryKey: ['admin', 'users', page, debouncedSearch],
        queryFn: async () => {
            const { data } = await adminApi.get('/users', {
                params: {
                    page,
                    limit: 20,
                    search: debouncedSearch
                }
            });
            return data;
        },
        placeholderData: keepPreviousData
    })

    // 🛡️ Observability: Log dropped users
    useEffect(() => {
        if (!data?.users) return
        const invalid = data.users.filter(u => !isValidUser(u))
        if (invalid.length > 0) {
            console.error('[Admin Users] 🚨 Dropped invalid users from view:', invalid)
        }
    }, [data])

    // Ban Mutation
    const banMutation = useMutation({
        mutationFn: async ({ id, ban }: { id: string, ban: boolean }) => {
            const { data } = await adminApi.post(`/users/${id}/ban`, { ban });
            return data;
        },
        onMutate: async ({ id, ban }) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: ['admin', 'users'] })

            // Snapshot previous value
            const previousData = queryClient.getQueryData<UsersResponse>(['admin', 'users', page, debouncedSearch])

            // Optimistically update
            queryClient.setQueryData<UsersResponse>(['admin', 'users', page, debouncedSearch], (old) => {
                if (!old) return old
                return {
                    ...old,
                    users: old.users.map(user =>
                        user.anonymous_id === id
                            ? { ...user, status: ban ? 'banned' : 'active' }
                            : user
                    )
                }
            })

            return { previousData }
        },
        onError: (_err, _newTodo, context) => {
            // Rollback on error
            if (context?.previousData) {
                queryClient.setQueryData(['admin', 'users', page, debouncedSearch], context.previousData)
            }
            showError('Falló la acción de cambio de estado')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
        }
    })

    const handleBanToggle = async (user: AdminUser) => {
        const isBanned = user.status === 'banned'
        if (await confirm({
            title: isBanned ? '¿Desbanear usuario?' : '¿BANEAR USUARIO?',
            description: isBanned
                ? `¿Restituir acceso a ${user.alias || 'este usuario'}?`
                : `Estás a punto de banear a ${user.alias || 'este usuario'}. Perderá el acceso inmediatamente.`,
            confirmText: isBanned ? 'Desbanear' : 'BANEAR',
            variant: isBanned ? 'default' : 'danger'
        })) {
            banMutation.mutate({ id: user.anonymous_id, ban: !isBanned })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <UsersIcon className="h-6 w-6 text-[#00ff88]" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Base de datos de ciudadanos anónimos</p>
                </div>

                <div className="relative w-full sm:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por Alias o ID..."
                        className="bg-[#0f172a] border border-[#1e293b] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00ff88]/50 w-full sm:w-64"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1) // Reset to page 1 on search
                        }}
                    />
                </div>
            </div>

            <div className="space-y-3 sm:bg-[#0f172a] sm:rounded-xl sm:border sm:border-[#1e293b] sm:overflow-hidden">
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-3">
                    {isLoading ? (
                        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-8 text-center text-[#00ff88]">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                            Cargando...
                        </div>
                    ) : data?.users?.length === 0 ? (
                        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-8 text-center">
                            <div className="p-4 bg-[#1e293b]/50 rounded-full w-fit mx-auto mb-3">
                                <UsersIcon className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="font-semibold text-slate-300">No se encontraron usuarios</p>
                            <p className="text-slate-500 text-xs mt-1">
                                Intenta con otro término de búsqueda.
                            </p>
                        </div>
                    ) : (
                        (data?.users || [])
                            .filter(isValidUser)
                            .map((user: AdminUser) => (
                                <div
                                    key={user.anonymous_id}
                                    className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4"
                                >
                                    <div className="flex items-start gap-3">
                                        <div className="h-12 w-12 rounded-full bg-[#1e293b] flex items-center justify-center border border-[#334155] overflow-hidden shrink-0">
                                            <img
                                                src={user.avatar_url || getAvatarUrl(user.anonymous_id)}
                                                alt=""
                                                className="h-full w-full object-cover"
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between">
                                                <div className="font-medium text-slate-200 truncate">
                                                    {user.alias || 'Anónimo'}
                                                </div>
                                                <StatusBadge status={user.status} />
                                            </div>
                                            <div className="text-xs font-mono text-slate-500 mt-0.5">
                                                {user.anonymous_id.substring(0, 8)}...
                                            </div>
                                            
                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1e293b]">
                                                <div className="flex items-center gap-4">
                                                    <div>
                                                        <div className="text-[10px] text-slate-500 uppercase">Trust</div>
                                                        <div className="text-sm font-bold text-slate-300">{user.trust_score}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-slate-500 uppercase">Reportes</div>
                                                        <div className="text-sm font-mono text-slate-300">{user.total_reports}</div>
                                                    </div>
                                                    <div>
                                                        <div className="text-[10px] text-slate-500 uppercase">Activo</div>
                                                        <div className="text-xs text-slate-400">
                                                            {formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true, locale: es })}
                                                        </div>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleBanToggle(user)}
                                                    disabled={banMutation.isPending}
                                                    className={`p-2 rounded hover:bg-[#1e293b] transition-colors ${user.status === 'banned' ? 'text-green-400' : 'text-red-400'}`}
                                                >
                                                    {user.status === 'banned' ? <UserCheck className="h-5 w-5" /> : <Ban className="h-5 w-5" />}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))
                    )}
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-400">
                        <thead className="bg-[#1e293b]/50 text-slate-200 font-medium uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Usuario</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Trust Score</th>
                                <th className="px-6 py-4">Reportes</th>
                                <th className="px-6 py-4">Última Actividad</th>
                                <th className="px-6 py-4 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b]">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-10 text-center text-[#00ff88]">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                                        Cargando base de datos...
                                    </td>
                                </tr>
                            ) : data?.users?.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-16 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-[#1e293b]/50 rounded-full">
                                                <UsersIcon className="w-8 h-8 text-slate-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-300">No se encontraron usuarios</p>
                                                <p className="text-slate-500 text-xs mt-1">
                                                    Intenta con otro término de búsqueda.
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                (data?.users || [])
                                    .filter(isValidUser)
                                    .map((user: AdminUser) => (
                                        <tr
                                            key={user.anonymous_id}
                                            onMouseEnter={(e) => {
                                                const { clientX, clientY } = e
                                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                                                hoverTimeoutRef.current = setTimeout(() => {
                                                    setHoveredUser({ user, x: clientX, y: clientY })
                                                }, 50)
                                            }}
                                            onMouseLeave={() => {
                                                if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
                                                setHoveredUser(null)
                                            }}
                                            className="hover:bg-[#1e293b]/30 transition-colors group relative"
                                        >
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-10 w-10 rounded-full bg-[#1e293b] flex items-center justify-center border border-[#334155] overflow-hidden">
                                                        <img
                                                            src={user.avatar_url || getAvatarUrl(user.anonymous_id)}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="font-medium text-slate-200">
                                                            {user.alias || 'Anónimo'}
                                                        </div>
                                                        <div className="text-xs font-mono text-slate-500" title={user.anonymous_id}>
                                                            {user.anonymous_id.substring(0, 8)}...
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <StatusBadge status={user.status} />
                                            </td>
                                            <td className="px-6 py-4">
                                                <TrustScoreBar score={user.trust_score} />
                                            </td>
                                            <td className="px-6 py-4 font-mono">
                                                {user.total_reports}
                                            </td>
                                            <td className="px-6 py-4 text-xs">
                                                {formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true, locale: es })}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => handleBanToggle(user)}
                                                    disabled={banMutation.isPending}
                                                    className={`p-2 rounded hover:bg-[#1e293b] transition-colors border border-transparent hover:border-[#334155] ${user.status === 'banned' ? 'text-green-400 hover:text-green-300' : 'text-red-400 hover:text-red-300'
                                                        }`}
                                                    title={user.status === 'banned' ? 'Desbanear' : 'Banear'}
                                                >
                                                    {user.status === 'banned' ? <UserCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Simple Pagination */}
                <div className="px-4 lg:px-6 py-4 border-t border-[#1e293b] flex justify-between items-center text-xs gap-2">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1.5 rounded bg-[#1e293b] text-slate-300 disabled:opacity-50 hover:bg-[#334155] whitespace-nowrap"
                    >
                        ← Anterior
                    </button>
                    <span className="text-slate-500 font-mono">Página {page}</span>
                    <button
                        disabled={!data || data.users.length < 20} // Assuming limit 20
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1.5 rounded bg-[#1e293b] text-slate-300 disabled:opacity-50 hover:bg-[#334155] whitespace-nowrap"
                    >
                        Siguiente →
                    </button>
                </div>
            </div>

            {/* Floating Ultra-Fast Preview */}
            <AnimatePresence>
                {hoveredUser && (
                    <UserPreview
                        user={hoveredUser.user}
                        x={hoveredUser.x}
                        y={hoveredUser.y}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

function UserPreview({ user, x, y }: { user: AdminUser, x: number, y: number }) {
    const boxWidth = 280
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800
    const margin = 20

    // NEW STRATEGY: Flip based on screen half
    // This is MUCH more robust than centering + clamping with unknown height

    const isBottomHalf = y > screenHeight / 2
    const isRightHalf = x > screenWidth / 2

    // Vertical Position
    let style: any = {
        position: 'fixed',
        width: boxWidth,
        zIndex: 9999,
        pointerEvents: 'none'
    }

    if (isBottomHalf) {
        style.bottom = (screenHeight - y) + 10
        // Clamp to top margin
        if (style.bottom > screenHeight - margin - 350) { // 350 is a safety min-height
            // if it's too tall, just use top: margin
        }
    } else {
        style.top = y + 10
    }

    // Horizontal Position
    if (isRightHalf) {
        style.right = (screenWidth - x) + 20
    } else {
        style.left = x + 20
    }

    return createPortal(
        <motion.div
            initial={{ opacity: 0, scale: 0.9, y: isBottomHalf ? 10 : -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={style}
            className="bg-[#0b1120]/98 backdrop-blur-xl border border-[#00ff88]/40 rounded-2xl p-5 shadow-[0_30px_60px_-12px_rgba(0,0,0,0.7),0_0_20px_rgba(0,255,136,0.15)] overflow-hidden"
        >
            {/* Header / Avatar */}
            <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-[#1e293b] border border-[#00ff88]/20 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
                    <img
                        src={user.avatar_url || getAvatarUrl(user.anonymous_id)}
                        alt=""
                        className="h-full w-full object-cover"
                    />
                </div>
                <div className="min-w-0">
                    <h3 className="text-white font-bold text-lg truncate">{user.alias || 'Anónimo'}</h3>
                    <div className="flex items-center gap-1.5 text-[#00ff88] text-xs font-bold uppercase tracking-wider">
                        <Award className="h-3 w-3" />
                        Nivel {user.level}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-[#1e293b]/50 rounded-xl p-3 border border-[#334155]/30">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                        <Activity className="h-3 w-3" />
                        Confianza
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-white">{user.trust_score}</span>
                        <span className="text-xs text-slate-500">/100</span>
                    </div>
                </div>
                <div className="bg-[#1e293b]/50 rounded-xl p-3 border border-[#334155]/30">
                    <div className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1 flex items-center gap-1">
                        <Shield className="h-3 w-3" />
                        Puntos
                    </div>
                    <div className="flex items-baseline gap-1">
                        <span className="text-xl font-bold text-white">{user.points || 0}</span>
                    </div>
                </div>
            </div>

            {/* Activity Feed Mini */}
            <div className="space-y-2.5">
                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest px-1">
                    Historial Reciente
                </div>
                <div className="bg-[#020617]/50 rounded-xl p-3 space-y-2 border border-[#334155]/20">
                    <div className="flex items-center gap-3 text-xs">
                        <FileText className="h-3.5 w-3.5 text-[#00ff88]" />
                        <span className="text-slate-300">Reportes creados:</span>
                        <span className="ml-auto font-mono text-white">{user.total_reports}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-slate-300">Comentarios:</span>
                        <span className="ml-auto font-mono text-white">{user.total_comments || 0}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs pt-1 border-t border-[#334155]/50">
                        <Calendar className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-slate-300">Miembro desde:</span>
                        <span className="ml-auto whitespace-nowrap text-slate-400">{new Date(user.created_at).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}</span>
                    </div>
                </div>
            </div>

            {/* User ID Footer */}
            <div className="mt-4 text-center">
                <span className="text-[9px] font-mono text-slate-600 truncate block">
                    UUID: {user.anonymous_id}
                </span>
            </div>

            {/* Background Glow Ornament */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-[#00ff88]/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none"></div>
        </motion.div>,
        document.body
    )
}

function StatusBadge({ status }: { status: string }) {
    if (status === 'banned') {
        return <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-red-500/10 text-red-500 border border-red-500/20">BANNED</span>
    }
    if (status === 'shadow_banned') {
        return <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-orange-500/10 text-orange-500 border border-orange-500/20">SHADOW</span>
    }
    return <span className="px-2 py-1 rounded text-[10px] uppercase font-bold bg-[#00ff88]/10 text-[#00ff88] border border-[#00ff88]/20">ACTIVE</span>
}

function TrustScoreBar({ score }: { score: number }) {
    let color = 'bg-[#00ff88]'
    if (score < 30) color = 'bg-red-500'
    else if (score < 70) color = 'bg-yellow-500'

    return (
        <div className="flex items-center gap-2">
            <span className={`text-xs font-bold w-6 ${score < 30 ? 'text-red-400' : 'text-slate-300'}`}>{score}</span>
            <div className="h-1.5 w-16 bg-[#1e293b] rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.min(100, Math.max(0, score))}%` }}
                ></div>
            </div>
        </div>
    )
}

function UsersIcon(props: any) {
    return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
}

// 🛡️ DATA INTEGRITY GUARD
function isValidUser(user: AdminUser): boolean {
    // 1. Check ID Format (UUIDv4 roughly)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    if (!user.anonymous_id || !uuidRegex.test(user.anonymous_id)) return false

    // 2. Check Logical Bounds
    if (typeof user.level !== 'number' || user.level < 0 || user.level > 100) return false
    if (typeof user.points !== 'number' || user.points < 0 || user.points > 1000000) return false

    // 3. Check Trust Score
    if (typeof user.trust_score !== 'number' || user.trust_score < 0 || user.trust_score > 100) return false

    return true
}
