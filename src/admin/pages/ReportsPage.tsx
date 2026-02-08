import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FileText, Search, AlertCircle, Eye, EyeOff, Flag, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { useDebounce } from '@/hooks/useDebounce'
import { getAvatarUrl } from '@/lib/avatar'
import { useAdminReports } from '../hooks/useAdminReports'
import { useReportModerationActions } from '../hooks/useReportModerationActions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast/useToast'
import type { AdminReport } from '../types/reports'
import { useConfirm } from '@/components/ui/useConfirm'

export function ReportsPage() {
    const navigate = useNavigate()
    const location = useLocation()
    const { addToast } = useToast()

    // Initial state from location state (preservation) or defaults
    const [page, setPage] = useState<number>(location.state?.fromPage || 1)
    const [search, setSearch] = useState<string>(location.state?.fromSearch || '')
    const [statusFilter, setStatusFilter] = useState<string>(location.state?.fromStatus || 'all')
    const debouncedSearch = useDebounce(search, 500)

    const { data, isLoading, isError, refetch } = useAdminReports({
        page,
        limit: 20,
        search: debouncedSearch,
        status: statusFilter === 'all' ? undefined : statusFilter
    })

    // We don't need the reportId for the list wide actions, we pass it to the mutate function
    const { toggleVisibility } = useReportModerationActions('')
    const { prompt } = useConfirm()

    const handleRowClick = (reportId: string) => {
        navigate(`/admin/reports/${reportId}`, {
            state: {
                fromPage: page,
                fromStatus: statusFilter,
                fromSearch: search,
                scrollPosition: window.scrollY
            }
        })
    }

    const handleToggleVisibility = async (e: React.MouseEvent, reportId: string, isCurrentlyHidden: boolean) => {
        e.stopPropagation()

        const actionPrefix = isCurrentlyHidden ? 'mostrar' : 'ocultar'
        const reason = await prompt({
            title: `${isCurrentlyHidden ? 'Mostrar' : 'Ocultar'} Reporte`,
            description: `Proporciona un motivo para ${actionPrefix} el reporte en el mapa público.`,
            placeholder: 'Justificación de visibilidad...',
            minLength: 5,
            confirmText: isCurrentlyHidden ? 'Mostrar Reporte' : 'Ocultar Reporte'
        })

        if (!reason) return // Canceled

        try {
            await toggleVisibility.mutateAsync({ id: reportId, is_hidden: !isCurrentlyHidden, reason })
            addToast(`El reporte ahora está ${!isCurrentlyHidden ? 'oculto' : 'visible'}.`, 'success')
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'No se pudo actualizar la visibilidad.'
            addToast(message, 'error')
        }
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] border-2 border-dashed border-red-500/20 rounded-xl bg-red-500/5">
                <AlertCircle className="w-12 h-12 text-red-500/50 mb-4" />
                <h3 className="text-lg font-semibold text-white">Error al cargar reportes</h3>
                <p className="text-slate-400 mb-4 text-sm">No se pudo conectar con el servidor de administración.</p>
                <Button onClick={() => refetch()} variant="outline" className="border-red-500/50 text-red-400 hover:bg-red-500/10">
                    Reintentar
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Reportes de la Comunidad</h1>
                    <p className="text-slate-400 text-sm">Administra y modera el contenido reportado por los usuarios.</p>
                </div>
            </header>

            {/* Filters Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <Input
                        placeholder="Buscar por título o descripción..."
                        className="pl-10 bg-[#0f172a] border-[#1e293b] text-white focus:border-blue-500/50"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value)
                            setPage(1)
                        }}
                    />
                </div>
                <div className="w-full md:w-[220px]">
                    <Select
                        value={statusFilter}
                        onChange={(e) => {
                            setStatusFilter(e.target.value)
                            setPage(1)
                        }}
                        className="bg-[#0f172a] border-[#1e293b] text-white focus:border-blue-500/50"
                    >
                        <option value="all">Todos los estados</option>
                        <option value="deleted">Eliminados</option>
                        <option value="abierto">Abierto</option>
                        <option value="en_progreso">En Progreso</option>
                        <option value="resuelto">Resuelto</option>
                        <option value="verificado">Verificado</option>
                        <option value="rechazado">Rechazado</option>
                        <option value="archivado">Archivado</option>
                    </Select>
                </div>
            </div>

            {/* Reports List - Mobile: Cards, Desktop: Table */}
            <div className="space-y-3 sm:bg-[#0f172a] sm:border sm:border-[#1e293b] sm:rounded-xl sm:overflow-hidden sm:shadow-2xl">
                {/* Mobile Cards */}
                <div className="sm:hidden space-y-3">
                    {isLoading ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 animate-pulse">
                                <div className="h-4 bg-[#1e293b] rounded w-3/4 mb-2"></div>
                                <div className="h-3 bg-[#1e293b] rounded w-1/2"></div>
                            </div>
                        ))
                    ) : data?.data.length === 0 ? (
                        <div className="bg-[#0f172a] border border-[#1e293b] rounded-xl p-8 text-center">
                            <div className="p-4 bg-[#1e293b]/50 rounded-full w-fit mx-auto mb-3">
                                <FileText className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="font-semibold text-slate-300">No se encontraron reportes</p>
                            <p className="text-slate-500 text-xs mt-1">
                                Intenta ajustar los filtros.
                            </p>
                        </div>
                    ) : (
                        data?.data.map((report: AdminReport) => (
                            <div
                                key={report.id}
                                onClick={() => handleRowClick(report.id)}
                                className={`bg-[#0f172a] border border-[#1e293b] rounded-xl p-4 cursor-pointer ${report.is_hidden ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-medium text-slate-200 text-sm break-words">{report.title}</h3>
                                            {report.flags_count > 0 && (
                                                <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] h-4 px-1">
                                                    <Flag className="w-2.5 h-2.5 mr-0.5" />
                                                    {report.flags_count}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <CategoryBadge category={report.category} />
                                            <span className="text-[11px] text-slate-500">
                                                {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1">
                                        <StatusBadge status={report.status} />
                                        {report.deleted_at && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border bg-red-500/10 text-red-500 border-red-500/20">
                                                Eliminado
                                            </span>
                                        )}
                                        {report.is_hidden && !report.deleted_at && (
                                            <span className="px-1.5 py-0.5 rounded text-[9px] uppercase font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20">
                                                Oculto
                                            </span>
                                        )}
                                    </div>
                                </div>
                                
                                <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1e293b]">
                                    <div className="flex items-center gap-2">
                                        <div className="h-6 w-6 rounded-full overflow-hidden bg-[#1e293b] border border-[#334155]">
                                            <img
                                                src={getAvatarUrl(report.author.avatar_url as string | null)}
                                                alt={report.author.alias || 'Author'}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            {report.author.alias || 'Anónimo'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className={`h-8 w-8 ${report.is_hidden ? 'text-red-400' : 'text-slate-400'}`}
                                            onClick={(e) => handleToggleVisibility(e, report.id, report.is_hidden)}
                                        >
                                            {report.is_hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </Button>
                                        <ChevronRight className="w-4 h-4 text-slate-500" />
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Desktop Table */}
                <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                        <thead className="bg-[#1e293b]/50 border-b border-[#1e293b] text-slate-300">
                            <tr>
                                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Reporte</th>
                                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Categoría</th>
                                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider">Autor</th>
                                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-center">Estado</th>
                                <th className="px-6 py-4 font-semibold uppercase text-xs tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#1e293b] text-slate-400 relative">
                            {isLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-6 py-4"><div className="h-4 bg-[#1e293b] rounded w-3/4"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-[#1e293b] rounded w-20"></div></td>
                                        <td className="px-6 py-4"><div className="h-4 bg-[#1e293b] rounded w-24"></div></td>
                                        <td className="px-6 py-4 text-center"><div className="h-6 bg-[#1e293b] rounded-full w-16 mx-auto"></div></td>
                                        <td className="px-6 py-4 text-right"><div className="h-8 bg-[#1e293b] rounded w-20 ml-auto"></div></td>
                                    </tr>
                                ))
                            ) : data?.data.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-20 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="p-4 bg-[#1e293b]/50 rounded-full">
                                                <FileText className="w-8 h-8 text-slate-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-slate-300">No se encontraron reportes</p>
                                                <p className="text-slate-500 text-xs mt-1">
                                                    Intenta ajustar los filtros o términos de búsqueda.
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                data?.data.map((report: AdminReport) => (
                                    <tr
                                        key={report.id}
                                        onClick={() => handleRowClick(report.id)}
                                        className={`hover:bg-white/5 transition-colors cursor-pointer group ${report.is_hidden ? 'opacity-60 grayscale-[0.5]' : ''}`}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col gap-1 max-w-[320px]">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-slate-200 truncate">{report.title}</span>
                                                    {report.is_hidden && (
                                                        <Badge variant="destructive" className="text-[9px] uppercase h-4 px-1 leading-none rounded">Oculto</Badge>
                                                    )}
                                                    {report.flags_count > 0 && (
                                                        <Badge variant="secondary" className="bg-orange-500/10 text-orange-400 border-orange-500/20 text-[9px] h-4 px-1 gap-0.5">
                                                            <Flag className="w-2.5 h-2.5" />
                                                            {report.flags_count}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-slate-500">
                                                    {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <CategoryBadge category={report.category} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded-full overflow-hidden bg-[#1e293b] border border-[#334155]">
                                                    <img
                                                        src={getAvatarUrl(report.author.avatar_url as string | null)}
                                                        alt={report.author.alias || 'Author'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                </div>
                                                <span className="truncate max-w-[120px] text-slate-300 whitespace-nowrap">
                                                    {report.author.alias || 'Anónimo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex flex-col items-center gap-1">
                                                <StatusBadge status={report.status} />
                                                {report.deleted_at && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border bg-red-500/10 text-red-500 border-red-500/20 whitespace-nowrap">
                                                        Eliminado
                                                    </span>
                                                )}
                                                {report.is_hidden && !report.deleted_at && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold border bg-orange-500/10 text-orange-400 border-orange-500/20 whitespace-nowrap">
                                                        Oculto
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 ${report.is_hidden ? 'text-red-400' : 'text-slate-400'} hover:text-white hover:bg-white/10`}
                                                    onClick={(e) => handleToggleVisibility(e, report.id, report.is_hidden)}
                                                    title={report.is_hidden ? "Mostrar en la app" : "Ocultar de la app"}
                                                >
                                                    {report.is_hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
                                                    onClick={() => handleRowClick(report.id)}
                                                >
                                                    <ChevronRight className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Footer / Pagination */}
                {data && data.meta.totalPages > 1 && (
                    <div className="px-6 py-4 border-t border-[#1e293b] flex items-center justify-between bg-black/20">
                        <div className="text-[11px] text-slate-500 font-mono">
                            MOSTRANDO {((page - 1) * 20) + 1}-{Math.min(page * 20, data.meta.total)} DE {data.meta.total} REPORTES
                        </div>
                        <div className="flex items-center gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="h-8 text-xs bg-[#1e293b] border-[#334155] text-slate-300 hover:text-white"
                            >
                                Anterior
                            </Button>

                            <span className="px-4 text-xs text-slate-500">
                                Página {page} de {data.meta.totalPages}
                            </span>

                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page >= data.meta.totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="h-8 text-xs bg-[#1e293b] border-[#334155] text-slate-300 hover:text-white"
                            >
                                Siguiente
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

function CategoryBadge({ category }: { category: string }) {
    const styles: Record<string, string> = {
        'Autos': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        'Bicicletas': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        'Celulares': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        'Laptops': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
        'Motos': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
        'security': 'bg-red-500/10 text-red-400 border-red-500/20'
    }

    return (
        <Badge variant="outline" className={`capitalize font-medium border ${styles[category] || 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>
            {category}
        </Badge>
    )
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        abierto: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
        en_progreso: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
        resuelto: 'bg-green-500/10 text-green-500 border-green-500/20',
        verificado: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
        rechazado: 'bg-red-500/10 text-red-500 border-red-500/20',
        archivado: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
    }

    const labels: Record<string, string> = {
        abierto: 'Abierto',
        en_progreso: 'En Progreso',
        resuelto: 'Resuelto',
        verificado: 'Verificado',
        rechazado: 'Rechazado',
        archivado: 'Archivado'
    }

    return (
        <Badge variant="outline" className={`capitalize font-bold border ${styles[status] || styles.abierto}`}>
            {labels[status] || status.replace('_', ' ')}
        </Badge>
    )
}
