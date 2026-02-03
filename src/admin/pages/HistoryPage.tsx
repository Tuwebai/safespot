
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    History, Search, ArrowLeft, ArrowRight,
    User, FileText, MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/Table';

interface AuditLogEntry {
    id: string;
    actor_id: string;
    target_type: 'report' | 'user' | 'comment';
    target_id: string;
    action_type: string;
    reason: string;
    internal_note?: string;
    snapshot: any;
    created_at: string;
    admin_users?: {
        email: string;
        alias?: string;
    };
}

export function ModerationHistory() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [typeFilter, setTypeFilter] = useState<string>('');
    const [entityIdFilter, setEntityIdFilter] = useState('');

    // Fetch Audit Log
    const { data, isLoading } = useQuery<{ data: AuditLogEntry[], pagination: any }>({
        queryKey: ['admin', 'moderation', 'history', page, typeFilter, entityIdFilter],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token');
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (typeFilter) params.append('type', typeFilter);
            if (entityIdFilter) params.append('entityId', entityIdFilter);

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/moderation/history?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) throw new Error('Failed to fetch history');
            return res.json();
        },
        placeholderData: (prev) => prev
    });

    const getActionColor = (action: string) => {
        switch (action) {
            case 'HIDE': return 'bg-red-500/10 text-red-500 border-red-500/20';
            case 'BAN': return 'bg-red-950 text-red-400 border-red-900';
            case 'RESTORE': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'DISMISS_FLAGS': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
            default: return 'bg-slate-800 text-slate-300';
        }
    };

    const getTargetIcon = (type: string) => {
        switch (type) {
            case 'report': return <FileText className="h-4 w-4" />;
            case 'comment': return <MessageSquare className="h-4 w-4" />;
            case 'user': return <User className="h-4 w-4" />;
            default: return <FileText className="h-4 w-4" />;
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <History className="h-6 w-6 text-indigo-400" />
                        Historial de Moderación
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">
                        Registro inmutable de todas las acciones legales y administrativas.
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4 p-4 bg-[#0f172a] border border-slate-800 rounded-xl">
                <div className="flex-1 max-w-sm relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Buscar por ID de entidad..."
                        className="pl-9 bg-slate-900 border-slate-700"
                        value={entityIdFilter}
                        onChange={(e) => setEntityIdFilter(e.target.value)}
                    />
                </div>

                <div className="w-48">
                    <select
                        className="w-full h-10 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="">Todos los tipos</option>
                        <option value="report">Reportes</option>
                        <option value="comment">Comentarios</option>
                        <option value="user">Usuarios</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-slate-800 bg-[#0f172a] overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-900/50">
                        <TableRow className="border-slate-800 hover:bg-slate-900/50">
                            <TableHead className="text-slate-400">Fecha</TableHead>
                            <TableHead className="text-slate-400">Actor</TableHead>
                            <TableHead className="text-slate-400">Acción</TableHead>
                            <TableHead className="text-slate-400">Objetivo</TableHead>
                            <TableHead className="text-slate-400">Razón</TableHead>
                            <TableHead className="text-slate-400">Snapshot</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                    Cargando auditoría...
                                </TableCell>
                            </TableRow>
                        ) : data?.data.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                    No hay registros de moderación.
                                </TableCell>
                            </TableRow>
                        ) : (
                            data?.data.map((log) => (
                                <TableRow key={log.id} className="border-slate-800 hover:bg-slate-800/30">
                                    <TableCell className="text-slate-300 font-mono text-xs">
                                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm", { locale: es })}
                                    </TableCell>
                                    <TableCell className="text-slate-300">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-white">
                                                {log.admin_users?.alias || 'System'}
                                            </span>
                                            <span className="text-xs text-slate-500">
                                                {log.admin_users?.email || log.actor_id.substring(0, 8)}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={cn("font-mono text-xs border", getActionColor(log.action_type))}>
                                            {log.action_type}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2 text-slate-300">
                                            {getTargetIcon(log.target_type)}
                                            <span className="font-mono text-xs text-slate-500 uppercase">
                                                {log.target_id.substring(0, 8)}...
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-[200px]">
                                        <div className="truncate text-slate-300" title={log.reason}>
                                            {log.reason}
                                        </div>
                                        {log.internal_note && (
                                            <div className="text-xs text-indigo-400 truncate mt-0.5">
                                                Nota: {log.internal_note}
                                            </div>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-slate-400 hover:text-white"
                                            onClick={() => navigate(`/admin/history/${log.id}`)}
                                        >
                                            <FileText className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>

                {/* Pagination */}
                <div className="flex items-center justify-between p-4 border-t border-slate-800 bg-slate-900/50">
                    <p className="text-xs text-slate-500">
                        Mostrando {data?.data.length || 0} de {data?.pagination?.total || 0} registros
                    </p>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 bg-transparent border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                            disabled={page === 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center justify-center px-3 text-sm text-slate-300 font-mono">
                            Página {page} de {data?.pagination?.pages || 1}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-8 p-0 bg-transparent border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                            disabled={!data || page >= (data.pagination?.pages || 1)}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ArrowRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>

            {/* Modal removed in favor of Detail Page */}
        </div>
    );
}

export default ModerationHistory;
