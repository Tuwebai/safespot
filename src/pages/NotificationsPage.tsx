import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useNotificationsQuery, NOTIFICATIONS_QUERY_KEY } from '@/hooks/queries/useNotificationsQuery';
import { useToast } from '@/components/ui/toast/useToast';
import { NotificationList } from '@/components/notifications/NotificationList';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { success } = useToast();
    const queryClient = useQueryClient();
    const { data: notifications = [], refetch, isLoading } = useNotificationsQuery();
    const [undoState, setUndoState] = useState<{ id: string, notification: any } | null>(null);

    // Mark as read handler
    const handleRead = async (id: string) => {
        // Optimistic update
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, (old: any[]) =>
            Array.isArray(old) ? old.map(n => n.id === id ? { ...n, is_read: true } : n) : []
        );

        try {
            await api.notifications.markRead(id);
        } catch (err) {
            console.error('Failed to mark read', err);
            refetch(); // Revert on error
        }
    };

    // Mark all read
    const handleMarkAllRead = async () => {
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, (old: any[]) =>
            Array.isArray(old) ? old.map(n => ({ ...n, is_read: true })) : []
        );
        await api.notifications.markAllRead();
        success("Todas las notificaciones marcadas como leídas");
    };

    // Delete Logic with Undo
    const handleDelete = async (id: string) => {
        const previousNotifications = queryClient.getQueryData<any[]>(NOTIFICATIONS_QUERY_KEY) || [];
        const notificationToDelete = previousNotifications.find(n => n.id === id);

        if (!notificationToDelete) return;

        // Optimistic Remove
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, (old: any[]) =>
            Array.isArray(old) ? old.filter(n => n.id !== id) : []
        );

        // Show Undo UI
        setUndoState({ id, notification: notificationToDelete });

        // Auto-dismiss undo after 5s and sync wipe?
        // We will optimistically assume delete. If they actually click Undo, we restore.
        // We trigger the API delete immediately for simplicity, if they undo we can't easily restore without "Undelete" API.
        // SO: We will WAIT 5 seconds before calling API.

        // Clearing previous timer if any (simple debounce logic not needed if we manage list of undos, but for single undo:)
        // We'll use a useEffect or just let the API call happen and re-insert if undo.
        // Better: "Soft delete" via optimistic UI. API call happens on unmount or after timeout?
        // Let's just call API. If undo, we re-insert via client cache and hope backend syncs later?
        // No, that's inconsistent.
        // Safe approach: Call API. If Undo, say "Restoring..." and call a create API? No.
        // Correct approach: Don't call API yet.
    };

    // Handle Undo Action
    const handleUndo = () => {
        if (!undoState) return;

        // Restore to cache
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, (old: any[]) => {
            const list = Array.isArray(old) ? [...old] : [];
            list.push(undoState.notification);
            // Sort again? simplified: just push.
            return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });

        setUndoState(null);
    };

    // Commit delete effect
    useEffect(() => {
        if (!undoState) return;

        const timer = setTimeout(async () => {
            await api.notifications.delete(undoState.id);
            setUndoState(null);
        }, 5000);

        return () => clearTimeout(timer);
    }, [undoState]);

    // Open Context Logic (The Core Requirement)
    const handleOpenContext = (n: any) => {
        // Mark read first
        if (!n.is_read) handleRead(n.id);

        switch (n.entity_type) {
            case 'report':
                navigate(`/reportes/${n.entity_id}`);
                break;
            case 'comment':
            case 'mention':
            case 'reply':
                // Navigate to report with highlight param
                navigate(`/reportes/${n.report_id}?highlight_comment=${n.entity_id}`);
                break;
            case 'badge':
            case 'achievement':
                navigate(`/gamificacion?tab=badges&highlight=${n.entity_id}`);
                break;
            case 'follow':
                navigate(`/perfil/${n.entity_id}`); // Go to user profile
                break;
            default:
                // Fallback
                if (n.report_id) navigate(`/reportes/${n.report_id}`);
        }
    };

    return (
        <div className="min-h-screen bg-background pb-24 safe-area-bottom">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">Notificaciones</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleMarkAllRead}
                        className="p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors"
                        title="Marcar todo como leído"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                    </button>
                    {/* Clear all (visual only for now/todo) */}
                    <button
                        className="p-2 text-muted-foreground hover:text-red-500 rounded-full hover:bg-accent transition-colors"
                        title="Limpiar todo"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            </header>

            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse">Cargando...</div>
            ) : (
                <NotificationList
                    notifications={notifications}
                    onRead={handleRead}
                    onDelete={handleDelete}
                    onOpenContext={handleOpenContext}
                />
            )}
            {undoState && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4">
                    <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 text-white p-4 rounded-lg shadow-xl animate-in slide-in-from-bottom-5">
                        <span className="flex items-center gap-2 text-sm">
                            <Trash2 className="w-4 h-4 text-red-500" />
                            Notificación eliminada
                        </span>
                        <button
                            onClick={handleUndo}
                            className="text-sm font-bold text-blue-400 hover:underline ml-4 uppercase"
                        >
                            Deshacer
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
