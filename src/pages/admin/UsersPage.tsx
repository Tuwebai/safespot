import { useState } from 'react'
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import {
    Search,
    Ban,
    UserCheck,
    Loader2
} from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { getAvatarUrl } from '@/lib/avatar'

interface AdminUser {
    anonymous_id: string
    alias: string | null
    avatar_url: string | null
    created_at: string
    last_active_at: string
    total_reports: number
    trust_score: number
    status: 'active' | 'banned' | 'shadow_banned'
    level: number
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
    const debouncedSearch = useDebounce(search, 500)
    const queryClient = useQueryClient()

    // Query Users
    const { data, isLoading } = useQuery<UsersResponse>({
        queryKey: ['admin', 'users', page, debouncedSearch],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token')
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                search: debouncedSearch
            })

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
            if (!res.ok) throw new Error('Failed to fetch users')
            return res.json()
        },
        placeholderData: keepPreviousData
    })

    // Ban Mutation
    const banMutation = useMutation({
        mutationFn: async ({ id, ban }: { id: string, ban: boolean }) => {
            const token = localStorage.getItem('safespot_admin_token')
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/users/${id}/ban`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ ban })
            })
            if (!res.ok) throw new Error('Failed to update user status')
            return res.json()
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
            alert('Falló la acción de baneo. Reintentando...')
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
        }
    })

    const handleBanToggle = (user: AdminUser) => {
        const isBanned = user.status === 'banned'
        if (confirm(`¿Estás seguro de que quieres ${isBanned ? 'desbanear' : 'BANEAR'} a este usuario?`)) {
            banMutation.mutate({ id: user.anonymous_id, ban: !isBanned })
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <UsersIcon className="h-6 w-6 text-[#00ff88]" />
                        Gestión de Usuarios
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Base de datos de ciudadanos anónimos</p>
                </div>

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Buscar por Alias o ID..."
                        className="bg-[#0f172a] border border-[#1e293b] rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-[#00ff88]/50 w-64"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1) // Reset to page 1 on search
                        }}
                    />
                </div>
            </div>

            <div className="bg-[#0f172a] rounded-xl border border-[#1e293b] overflow-hidden">
                <div className="overflow-x-auto">
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
                                    <td colSpan={6} className="px-6 py-10 text-center">
                                        No se encontraron usuarios
                                    </td>
                                </tr>
                            ) : (
                                data?.users?.map((user: AdminUser) => (
                                    <tr key={user.anonymous_id} className="hover:bg-[#1e293b]/30 transition-colors group">
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
                <div className="px-6 py-4 border-t border-[#1e293b] flex justify-between items-center text-xs">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                        className="px-3 py-1 rounded bg-[#1e293b] text-slate-300 disabled:opacity-50 hover:bg-[#334155]"
                    >
                        Anterior
                    </button>
                    <span className="text-slate-500">Página {page}</span>
                    <button
                        disabled={!data || data.users.length < 20} // Assuming limit 20
                        onClick={() => setPage(p => p + 1)}
                        className="px-3 py-1 rounded bg-[#1e293b] text-slate-300 disabled:opacity-50 hover:bg-[#334155]"
                    >
                        Siguiente
                    </button>
                </div>
            </div>
        </div>
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
