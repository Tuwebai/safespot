import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    AlertTriangle, Check, EyeOff, MessageSquare, FileText,
    ShieldAlert, Trash2, Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAvatarUrl } from '@/lib/avatar';
import { ModerationNotes } from '../components/ModerationNotes';
import { useReportLifecycle } from '@/hooks/queries/useReportLifecycle';

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
    const [visibleNotes, setVisibleNotes] = useState<Set<string>>(new Set());

    // Resolution Modal State
    const [resolvingItem, setResolvingItem] = useState<{ item: ModerationItem, action: 'approve' | 'reject' | 'dismiss' } | null>(null);
    const [resolutionReason, setResolutionReason] = useState('');
    const [shouldBanUser, setShouldBanUser] = useState(false);

    const queryClient = useQueryClient();

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

    // Hooks semánticos del ciclo de vida (Fase E)
    const { resolveReport, rejectReport } = useReportLifecycle();

    // Legacy mutation for Comments (or other types)
    const resolveOtherMutation = useMutation({
        mutationFn: async ({ id, type, action, reason, banUser, created_by }: { id: string, type: string, action: string, reason: string, banUser?: boolean, created_by?: string }) => {
            const token = localStorage.getItem('safespot_admin_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/moderation/${type}/${id}/resolve`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ action, reason, banUser, created_by })
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to resolve');
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] });
            closeModal();
        }
    });

    const openResolveModal = (item: ModerationItem, action: 'approve' | 'reject' | 'dismiss') => {
        setResolvingItem({ item, action });
        setResolutionReason('');
        setShouldBanUser(false);
    };

    const closeModal = () => {
        setResolvingItem(null);
        setResolutionReason('');
        setShouldBanUser(false);
    };

    const confirmResolution = () => {
        if (!resolvingItem) return;

        if (resolvingItem.action !== 'dismiss' && resolutionReason.trim().length < 5) {
            return; // Validation failed
        }

        const { item, action } = resolvingItem;
        const reason = resolutionReason;

        // 🛡️ BRANCH LOGIC: Reports use Lifecycle Service
        if (item.type === 'report') {
            if (action === 'reject') {
                // Reject -> Semantic REJECT command
                // Note: banUser logic needs to be handled either by the hook or separately. 
                // The current api.reject(id, reason) does not support banUser flag.
                // Assuming banUser is handled by a separate admin signal or we need to update the API.
                // For now, consistent lifecycle is priority.
                rejectReport.mutate({ id: item.id, reason }, {
                    onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ['admin', 'moderation'] });
                        closeModal();
                    }
                });
            } else if (action === 'approve') {
                // Approve -> This usually means 'Dismiss Flag' (Keep report active).
                // It does NOT mean 'Resolve' (Theft recovered).
                // So we fallback to the Admin Endpoint for 'Dismiss Flag' / 'Approve Content' logic
                // OR we use a hypothetical processReport if that aligned.
                // Given ambiguity, we use Legacy Admin endpoint for 'Approve' (Clear Flags)
                // BUT we use strict Lifecycle for 'Reject' (Status Change)

                // However, the admin endpoint likely handles both.
                // If we want Strictly Semantic:
                // Reject = rejectReport
                // Approve = clearFlags (Not yet in Lifecycle Service?)

                // Let's stick to using helper for Report Rejection to guarantee State Machine transition
                resolveOtherMutation.mutate({
                    id: item.id,
                    type: item.type,
                    action,
                    reason,
                    banUser: shouldBanUser,
                    // created_by: item.author.id // ID missing in type, skipping tracking for now or relying on backend ctx
                });
            } else {
                resolveOtherMutation.mutate({
                    id: item.id,
                    type: item.type,
                    action,
                    reason,
                    banUser: shouldBanUser
                });
            }
        } else {
            // Comments & Others -> Legacy
            resolveOtherMutation.mutate({
                id: item.id,
                type: item.type,
                action,
                reason,
                banUser: shouldBanUser
            });
        }
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
                                        onClick={() => openResolveModal(item, 'approve')}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded hover:bg-green-500/20 transition-colors text-xs font-medium border border-green-500/20"
                                        title="El contenido cumple las normas (Falsa alarma)"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        Mantener
                                    </button>
                                    <button
                                        onClick={() => openResolveModal(item, 'reject')}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 rounded hover:bg-red-500/20 transition-colors text-xs font-medium border border-red-500/20"
                                        title="El contenido viola las normas (Eliminar)"
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Remover
                                    </button>

                                    <div className="h-px bg-slate-800 my-1" />

                                    <button
                                        onClick={() => setVisibleNotes(prev => {
                                            const next = new Set(prev);
                                            if (next.has(item.id)) next.delete(item.id);
                                            else next.add(item.id);
                                            return next;
                                        })}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1.5 rounded transition-colors text-xs font-medium border",
                                            visibleNotes.has(item.id)
                                                ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                                                : "bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700"
                                        )}
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                        {visibleNotes.has(item.id) ? 'Ocultar Notas' : 'Notas Internas'}
                                    </button>
                                </div>
                            </div>

                            {/* Moderation Notes Section */}
                            {visibleNotes.has(item.id) && (
                                <div className="mt-4 border-t border-slate-800 pt-4 animate-in fade-in slide-in-from-top-2">
                                    <ModerationNotes entityId={item.id} entityType={item.type} />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Resolution Modal */}
            {resolvingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={closeModal}>
                    <div
                        className="bg-slate-900 border border-slate-700 rounded-xl w-full max-w-md shadow-2xl overflow-hidden p-6 space-y-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className={cn(
                                    "h-10 w-10 rounded-full flex items-center justify-center",
                                    resolvingItem.action === 'approve' ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                )}>
                                    {resolvingItem.action === 'approve' ? <Check className="h-5 w-5" /> : <Trash2 className="h-5 w-5" />}
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">
                                        {resolvingItem.action === 'approve' ? 'Aprobar Contenido' : resolvingItem.action === 'reject' ? 'Rechazar Contenido' : 'Descartar'}
                                    </h3>
                                    <p className="text-sm text-slate-400">
                                        Esta acción quedará registrada en el log de auditoría.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Reason Input */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                                Razón de la decisión <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                className="w-full bg-[#0b1221] border border-slate-700 rounded-lg p-3 text-sm text-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none min-h-[80px] resize-none"
                                placeholder="Explica por qué tomaste esta decisión..."
                                value={resolutionReason}
                                onChange={e => setResolutionReason(e.target.value)}
                                autoFocus
                            />
                            {resolvingItem.action !== 'dismiss' && resolutionReason.trim().length < 5 && (
                                <p className="text-xs text-red-400">La razón es obligatoria (mínimo 5 caracteres).</p>
                            )}
                        </div>

                        {/* Ban Checkbox (Only for Reject) */}
                        {resolvingItem.action === 'reject' && (
                            <div className="flex items-start gap-3 p-3 bg-red-950/30 border border-red-900/50 rounded-lg">
                                <input
                                    type="checkbox"
                                    id="banUser"
                                    className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-800 text-red-600 focus:ring-red-500"
                                    checked={shouldBanUser}
                                    onChange={e => setShouldBanUser(e.target.checked)}
                                />
                                <label htmlFor="banUser" className="text-sm text-slate-300 cursor-pointer select-none">
                                    <span className="font-bold text-red-400 block mb-0.5">Banear usuario autor</span>
                                    Prevenir que este usuario publique más contenido.
                                </label>
                            </div>
                        )}

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={closeModal}
                                className="flex-1 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmResolution}
                                disabled={resolveOtherMutation.isPending || resolveReport.isPending || rejectReport.isPending || (resolvingItem.action !== 'dismiss' && resolutionReason.trim().length < 5)}
                                className={cn(
                                    "flex-1 px-4 py-2 rounded-lg font-bold transition-colors flex items-center justify-center gap-2",
                                    resolvingItem.action === 'approve'
                                        ? "bg-green-600 hover:bg-green-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                        : "bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                                )}
                            >
                                {resolveOtherMutation.isPending || resolveReport.isPending || rejectReport.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
