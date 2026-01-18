import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    AlertTriangle, Check, X, EyeOff, MessageSquare, FileText,
    ShieldAlert, Trash2, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/lib/avatar';
import { useConfirm } from '@/components/ui/confirmation-manager';

interface ModerationItem {
    id: string;
    type: 'report' | 'comment';
    content: {
        title?: string;
        description?: string;
        text?: string;
        reportTitle?: string;
        images?: string[];
    };
    author: {
        alias: string;
        anonymous_id: string;
        avatar_url?: string;
    };
    reason: string;
    flags_count: number;
    created_at: string;
    status: 'active' | 'hidden';
}

export function ModerationPage() {
    const [activeTab, setActiveTab] = useState<'report' | 'comment'>('report');
    const queryClient = useQueryClient();
    const { confirm } = useConfirm();

    // Fetch Pending Items
    const { data: items, isLoading } = useQuery<ModerationItem[]>({
        queryKey: ['admin', 'moderation', 'pending', activeTab],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/moderation/pending?type=${activeTab}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch moderation queue');
            const json = await res.json();
            return json.data;
        }
    });

    // Resolve Mutation
    const resolveMutation = useMutation({
        mutationFn: async ({ id, type, action, banUser }: { id: string, type: string, action: string, banUser?: boolean }) => {
            const token = localStorage.getItem('safespot_admin_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/moderation/${type}/${id}/resolve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, banUser })
            });
            if (!res.ok) throw new Error('Failed to resolve');
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] });
        }
    });

    const handleAction = async (item: ModerationItem, action: 'approve' | 'reject' | 'dismiss') => {
        let banUser = false;
        if (action === 'reject') {
            if (await confirm({
                title: '¿Banear usuario?',
                description: '¿Deseas también BANEAR al usuario autor de este contenido para prevenir futuros incidentes?',
                confirmText: 'Sí, banear usuario',
                cancelText: 'No, solo rechazar contenido',
                variant: 'danger'
            })) {
                banUser = true;
            }
        }
        resolveMutation.mutate({ id: item.id, type: item.type, action, banUser });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6 text-orange-500" />
                        Moderación
                    </h1>
                    <p className="text-slate-400 text-sm mt-1">Revisión de reportes conflictivos y contenido marcado.</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-4 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('report')}
                    className={cn(
                        "pb-3 px-4 text-sm font-medium transition-colors relative",
                        activeTab === 'report' ? "text-orange-500" : "text-slate-400 hover:text-slate-200"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Reportes Pendientes
                    </div>
                    {activeTab === 'report' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('comment')}
                    className={cn(
                        "pb-3 px-4 text-sm font-medium transition-colors relative",
                        activeTab === 'comment' ? "text-orange-500" : "text-slate-400 hover:text-slate-200"
                    )}
                >
                    <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        Comentarios Marcados
                    </div>
                    {activeTab === 'comment' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-orange-500" />
                    )}
                </button>
            </div>

            {/* Queue List */}
            <div className="space-y-4">
                {isLoading ? (
                    <div className="text-center py-10 text-slate-500">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                        Cargando cola de moderación...
                    </div>
                ) : items?.length === 0 ? (
                    <div className="text-center py-20 bg-[#0f172a] rounded-xl border border-slate-800 border-dashed">
                        <Check className="h-10 w-10 text-green-500 mx-auto mb-3" />
                        <h3 className="text-lg font-medium text-slate-200">¡Todo limpío!</h3>
                        <p className="text-slate-400">No hay contenido pendiente de revisión.</p>
                    </div>
                ) : (
                    items?.map(item => (
                        <div key={item.id} className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
                            <div className="flex items-start justify-between gap-4">
                                {/* Icon & Status */}
                                <div className="mt-1">
                                    {item.status === 'hidden' ? (
                                        <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center text-red-500" title="Contenido Oculto">
                                            <EyeOff className="h-5 w-5" />
                                        </div>
                                    ) : (
                                        <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500" title="Reportado">
                                            <AlertTriangle className="h-5 w-5" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn(
                                            "text-xs font-bold px-2 py-0.5 rounded uppercase",
                                            item.status === 'hidden' ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"
                                        )}>
                                            {item.reason}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                            • Hace {formatDistanceToNow(new Date(item.created_at), { locale: es })}
                                        </span>
                                        {item.flags_count > 0 && (
                                            <span className="text-xs text-red-400 font-mono bg-red-950 px-1.5 rounded">
                                                {item.flags_count} reportes
                                            </span>
                                        )}
                                    </div>

                                    {item.type === 'report' ? (
                                        <>
                                            <h3 className="text-lg font-bold text-white mb-1 truncate">{item.content.title}</h3>
                                            <p className="text-slate-400 text-sm line-clamp-2">{item.content.description}</p>
                                        </>
                                    ) : (
                                        <>
                                            <p className="text-white text-sm italic mb-1">"{item.content.text}"</p>
                                            <p className="text-slate-500 text-xs">En reporte: <span className="text-slate-300">{item.content.reportTitle}</span></p>
                                        </>
                                    )}

                                    <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                                        <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center overflow-hidden">
                                            <img
                                                src={item.author.avatar_url || getAvatarUrl(item.author.anonymous_id)}
                                                className="h-full w-full object-cover"
                                                alt=""
                                            />
                                        </div>
                                        <span>Autor: <span className="text-slate-300">{item.author.alias || 'Anónimo'}</span></span>
                                        <span className="font-mono text-slate-600">({item.author.anonymous_id.substring(0, 8)})</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2">
                                    <button
                                        onClick={() => handleAction(item, 'approve')}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors text-xs font-medium border border-green-500/20"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        Aprobar
                                    </button>
                                    <button
                                        onClick={() => handleAction(item, 'dismiss')}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 text-slate-400 rounded hover:bg-slate-700 transition-colors text-xs font-medium border border-slate-700"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                        Ignorar
                                    </button>
                                    <button
                                        onClick={() => handleAction(item, 'reject')}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors text-xs font-medium border border-red-500/20"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Eliminar
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
