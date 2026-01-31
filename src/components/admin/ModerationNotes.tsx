import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Send, StickyNote, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
// cn removed as unused
// getAvatarUrl removed as unused

interface ModerationNote {
    id: string;
    note: string;
    created_by: string;
    created_at: string;
}

interface ModerationNotesProps {
    entityId: string;
    entityType: 'report' | 'comment';
}

export function ModerationNotes({ entityId, entityType }: ModerationNotesProps) {
    const [note, setNote] = useState('');
    const queryClient = useQueryClient();

    // Fetch Notes
    const { data: notes, isLoading } = useQuery<ModerationNote[]>({
        queryKey: ['admin', 'moderation', 'notes', entityType, entityId],
        queryFn: async () => {
            const token = localStorage.getItem('safespot_admin_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/moderation/${entityType}/${entityId}/notes`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch notes');
            const json = await res.json();
            return json.data || [];
        }
    });

    // Add Note Mutation
    const addNoteMutation = useMutation({
        mutationFn: async (text: string) => {
            const token = localStorage.getItem('safespot_admin_token');
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/moderation/${entityType}/${entityId}/notes`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ note: text })
            });
            if (!res.ok) throw new Error('Failed to create note');
            return res.json();
        },
        onSuccess: () => {
            setNote('');
            queryClient.invalidateQueries({ queryKey: ['admin', 'moderation', 'notes', entityType, entityId] });
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (note.trim().length < 3) return;
        addNoteMutation.mutate(note);
    };

    return (
        <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 mt-4">
            <h4 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-indigo-400" />
                Notas Internas
            </h4>

            {/* Timeline */}
            <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center py-4">
                        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                    </div>
                ) : notes?.length === 0 ? (
                    <p className="text-xs text-slate-500 italic text-center py-2">
                        No hay notas registradas.
                    </p>
                ) : (
                    notes?.map((n: any) => {
                        const isMasterAdmin = n.created_by === '00000000-0000-0000-0000-000000000000';

                        // Use admin name from JOIN, fallback to email, name or Master label
                        const adminName = n.admin_users?.alias || n.admin_users?.email?.split('@')[0] || (isMasterAdmin ? 'Master Admin' : 'Admin');
                        const adminLabel = isMasterAdmin ? 'SafeSpot Team' : adminName;

                        // Enterprise-grade relative time
                        const date = new Date(n.created_at);
                        const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
                        let timeLabel = formatDistanceToNow(date, { locale: es, addSuffix: true });

                        if (seconds < 60) {
                            timeLabel = 'Hace unos segundos';
                        }

                        return (
                            <div key={n.id} className="bg-slate-800/40 p-3 rounded-lg text-sm border border-slate-700/50 hover:border-indigo-500/30 transition-colors">
                                <p className="text-slate-200 leading-relaxed whitespace-pre-wrap">{n.note}</p>
                                <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-700/30">
                                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-400/80 uppercase tracking-tighter">
                                        <div className={`h-1.5 w-1.5 rounded-full ${isMasterAdmin ? 'bg-indigo-400' : 'bg-slate-500'}`} />
                                        {adminLabel}
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">
                                        {timeLabel}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Input */}
            <form onSubmit={handleSubmit} className="flex gap-2 items-end">
                <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Escribir nota interna..."
                    className="min-h-[60px] bg-slate-950 border-slate-800 focus:border-indigo-500/50 text-sm resize-none"
                    maxLength={500}
                />
                <Button
                    type="submit"
                    size="sm"
                    className="h-[60px] px-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                    disabled={note.trim().length < 3 || addNoteMutation.isPending}
                >
                    {addNoteMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Send className="h-4 w-4" />
                    )}
                </Button>
            </form>
        </div>
    );
}
