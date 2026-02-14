import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
    useNotificationsQuery,
    NOTIFICATIONS_QUERY_KEY,
    useMarkNotificationReadMutation,
    useMarkAllNotificationsReadMutation,
    useDeleteAllNotificationsMutation
} from '@/hooks/queries/useNotificationsQuery';
import { useToast } from '@/components/ui/toast/useToast';
import { NotificationList } from '@/components/notifications/NotificationList';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { useConfirm } from '@/components/ui/useConfirm';
// 🔴 CRITICAL FIX: Auth guard for notification delete
import { useAuthGuard } from '@/hooks/useAuthGuard';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: string;
    entity_id?: string;
    entity_type?: string;
    report_id?: string;
    is_read: boolean;
    created_at: string;
}

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { confirm } = useConfirm(); // Initialized confirm hook
    const { success } = useToast();
    const queryClient = useQueryClient();
    const { data: notifications = [], isLoading } = useNotificationsQuery();
    const [undoState, setUndoState] = useState<{ id: string, notification: Notification } | null>(null);

    const markReadMutation = useMarkNotificationReadMutation();
    const markAllReadMutation = useMarkAllNotificationsReadMutation();
    const deleteAllMutation = useDeleteAllNotificationsMutation();

    // Enable SSE for real-time list updates (tab-sync)
    useUserNotifications();
    const { checkAuth } = useAuthGuard(); // 🔴 CRITICAL FIX: Auth guard

    // Mark as read handler
    const handleRead = (id: string) => {
        markReadMutation.mutate(id);
    };

    // Mark all read
    const handleMarkAllRead = () => {
        markAllReadMutation.mutate(undefined, {
            onSuccess: () => success("Todas las notificaciones marcadas como leídas")
        });
    };

    // Delete All Logic
    const clearAll = () => {
        deleteAllMutation.mutate(undefined, {
            onSuccess: () => success("Notificaciones eliminadas")
        });
    };

    const handleClearAll = async () => {
        if (await confirm({
            title: '¿Eliminar todas?',
            description: '¿Estás seguro de que quieres eliminar todas las notificaciones? No podrás recuperarlas.',
            confirmText: 'Eliminar todas',
            variant: 'danger'
        })) {
            clearAll();
        }
    };

    // Delete Logic with Undo
    const handleDelete = async (id: string) => {
        const activeKey = ['notifications', 'list', queryClient.getQueryData(['anonymous_id'])];
        const previousNotifications = notifications as Notification[];
        const notificationToDelete = previousNotifications.find(n => n.id === id);

        if (!notificationToDelete) return;

        // Optimistic Remove (Manual since we need undo logic)
        queryClient.setQueryData(activeKey, (old: Notification[] | undefined) =>
            Array.isArray(old) ? old.filter(n => n.id !== id) : []
        );

        // Show Undo UI
        setUndoState({ id, notification: notificationToDelete });
    };

    // Handle Undo Action
    const handleUndo = () => {
        if (!undoState) return;

        // Restore to cache
        queryClient.setQueryData(NOTIFICATIONS_QUERY_KEY, (old: Notification[] | undefined) => {
            const list = Array.isArray(old) ? [...old] : [];
            list.push(undoState.notification);
            return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        });

        setUndoState(null);
    };

    // Commit delete effect
    useEffect(() => {
        if (!undoState) return;

        const timer = setTimeout(async () => {
            if (!checkAuth()) {
                const activeKey = ['notifications', 'list', queryClient.getQueryData(['anonymous_id'])];
                queryClient.invalidateQueries({ queryKey: activeKey });
                setUndoState(null);
                return;
            }

            try {
                const { notificationsApi } = await import('@/lib/api');
                await notificationsApi.delete(undoState.id);
            } catch (err) {
                console.error('Failed to delete notification', err);
                const activeKey = ['notifications', 'list', queryClient.getQueryData(['anonymous_id'])];
                queryClient.invalidateQueries({ queryKey: activeKey });
            } finally {
                setUndoState(null);
            }
        }, 5000);

        return () => clearTimeout(timer);
    }, [undoState, queryClient, checkAuth]);

    // Open Context Logic
    const handleOpenContext = (n: Notification) => {
        if (!n.is_read) handleRead(n.id);

        const type = n.entity_type || n.type;

        switch (type) {
            case 'report':
                navigate(`/reporte/${n.entity_id || n.report_id}`);
                break;
            case 'comment':
            case 'mention':
            case 'reply':
                // Navigate to report with highlight param
                navigate(`/reporte/${n.report_id}?highlight_comment=${n.entity_id}`);
                break;
            case 'badge':
            case 'achievement':
                navigate(`/gamificacion?tab=badges&highlight=${n.entity_id}`);
                break;
            case 'user': // SSOT: Follows use 'user' entity_type
            case 'follow':
                navigate(`/usuario/${n.entity_id}`);
                break;
            default:
                // Fallback
                if (n.report_id) navigate(`/reporte/${n.report_id}`);
        }
    };

    // BUG 3 & 4 FIX: Computed states for button disabled logic
    const hasUnread = notifications.some(n => !n.is_read);
    const hasNotifications = notifications.length > 0;

    return (
        <div className="min-h-screen bg-background pb-24 safe-area-bottom">
            {/* Header */}
            <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">Notificaciones</h1>
                <div className="flex gap-2">
                    {/* BUG 3 FIX: Disabled when all notifications are read */}
                    <button
                        onClick={handleMarkAllRead}
                        disabled={!hasUnread}
                        className={`p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors ${!hasUnread ? 'opacity-40 cursor-not-allowed' : ''}`}
                        title="Marcar todo como leído"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                    </button>
                    {/* BUG 4 FIX: Disabled when no notifications exist */}
                    <button
                        onClick={handleClearAll}
                        disabled={!hasNotifications}
                        className={`p-2 text-muted-foreground hover:text-red-500 rounded-full hover:bg-accent transition-colors ${!hasNotifications ? 'opacity-40 cursor-not-allowed' : ''}`}
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
                <div className={`fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-sm px-4 z-50`}>
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
