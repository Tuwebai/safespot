import { Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    useNotificationsQuery,
    useMarkNotificationReadMutation,
    useMarkAllNotificationsReadMutation,
    useDeleteAllNotificationsMutation,
    useDeleteNotificationMutation
} from '@/hooks/queries/useNotificationsQuery';
import { useToast } from '@/components/ui/toast/useToast';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useUserNotifications } from '@/hooks/useUserNotifications';
import { useConfirm } from '@/components/ui/useConfirm';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { useAnonymousId } from '@/hooks/useAnonymousId';
import { lazyRetry } from '@/lib/lazyRetry';

import type { Notification } from '@/lib/api';

const NotificationList = lazyRetry(
    () => import('@/components/notifications/NotificationList').then((m) => ({ default: m.NotificationList })),
    'NotificationList'
);

export default function NotificationsPage() {
    const navigate = useNavigate();
    const { confirm } = useConfirm();
    const { success } = useToast();
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();
    const { data: notifications = [], isLoading } = useNotificationsQuery();

    const markReadMutation = useMarkNotificationReadMutation();
    const markAllReadMutation = useMarkAllNotificationsReadMutation();
    const deleteAllMutation = useDeleteAllNotificationsMutation();
    const deleteNotificationMutation = useDeleteNotificationMutation();

    useUserNotifications();
    const { checkAuth } = useAuthGuard();

    const handleRead = (id: string) => {
        markReadMutation.mutate(id);
    };

    const handleMarkAllRead = () => {
        markAllReadMutation.mutate(undefined, {
            onSuccess: () => success('Todas las notificaciones marcadas como leidas')
        });
    };

    const clearAll = () => {
        deleteAllMutation.mutate(undefined, {
            onSuccess: () => success('Notificaciones eliminadas')
        });
    };

    const handleClearAll = async () => {
        if (await confirm({
            title: 'Eliminar todas?',
            description: 'Estas seguro de que quieres eliminar todas las notificaciones? No podras recuperarlas.',
            confirmText: 'Eliminar todas',
            variant: 'danger'
        })) {
            clearAll();
        }
    };

    // 0ms visual update + backend validation in background
    const handleDelete = async (id: string) => {
        const activeKey = ['notifications', 'list', anonymousId];
        const previousNotifications = (queryClient.getQueryData(activeKey) as Notification[] | undefined) || [];

        if (!checkAuth()) {
            queryClient.invalidateQueries({ queryKey: activeKey });
            return;
        }

        queryClient.setQueryData(activeKey, (old: Notification[] | undefined) =>
            Array.isArray(old) ? old.filter((n) => n.id !== id) : []
        );

        try {
            await deleteNotificationMutation.mutateAsync(id);
        } catch (err) {
            console.error('Failed to delete notification', err);
            queryClient.setQueryData(activeKey, previousNotifications);
            queryClient.invalidateQueries({ queryKey: activeKey });
        }
    };

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
                navigate(`/reporte/${n.report_id}?highlight_comment=${n.entity_id}`);
                break;
            case 'badge':
            case 'achievement':
                navigate(`/gamificacion?tab=badges&highlight=${n.entity_id}`);
                break;
            case 'user':
            case 'follow':
                navigate(`/usuario/${n.entity_id}`);
                break;
            default:
                if (n.report_id) navigate(`/reporte/${n.report_id}`);
        }
    };

    const hasUnread = notifications.some((n) => !n.is_read);
    const hasNotifications = notifications.length > 0;

    return (
        <div className="min-h-screen bg-background pb-24 safe-area-bottom">
            <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center justify-between">
                <h1 className="text-xl font-bold">Notificaciones</h1>
                <div className="flex gap-2">
                    <button
                        onClick={handleMarkAllRead}
                        disabled={!hasUnread}
                        className={`p-2 text-muted-foreground hover:text-foreground rounded-full hover:bg-accent transition-colors ${!hasUnread ? 'opacity-40 cursor-not-allowed' : ''}`}
                        title="Marcar todo como leido"
                    >
                        <CheckCircle2 className="w-5 h-5" />
                    </button>
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
                <Suspense fallback={<div className="p-8 text-center text-muted-foreground animate-pulse">Cargando...</div>}>
                    <NotificationList
                        notifications={notifications}
                        onRead={handleRead}
                        onDelete={handleDelete}
                        onOpenContext={handleOpenContext}
                    />
                </Suspense>
            )}
        </div>
    );
}
