import { useState } from 'react';
import { NotificationItem } from './NotificationItem';
import { EmptyState } from '@/components/ui/empty-state';
import { format, isToday, isYesterday } from 'date-fns';
import { es } from 'date-fns/locale';
import { BellOff } from 'lucide-react';

import { Notification } from '@/pages/NotificationsPage';

interface NotificationListProps {
    notifications: Notification[];
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
    onOpenContext: (notification: Notification) => void;
}

export function NotificationList({ notifications, onRead, onDelete, onOpenContext }: NotificationListProps) {
    const [contextMenu, setContextMenu] = useState<{ id: string; x?: number; y?: number } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        setContextMenu({ id, x: e.clientX, y: e.clientY });
    };

    const handleMobileMenu = (open: boolean, id: string) => {
        if (open) setContextMenu({ id });
        else setContextMenu(null);
    };

    const handleCloseMenu = () => {
        setContextMenu(null);
    };

    if (notifications.length === 0) {
        return (
            <div className="py-20 px-4">
                <EmptyState
                    variant="default"
                    icon={BellOff}
                    title="Estás al día"
                    description="No tienes notificaciones nuevas por ahora. Disfruta de la tranquilidad."
                    className="max-w-sm mx-auto"
                />
            </div>
        );
    }

    // Grouping Logic
    const grouped = notifications.reduce((acc: Record<string, Notification[]>, notification: Notification) => {
        const date = new Date(notification.created_at);
        let key = 'Anteriormente';

        if (isToday(date)) key = 'Hoy';
        else if (isYesterday(date)) key = 'Ayer';
        else key = format(date, "d 'de' MMMM", { locale: es });

        if (!acc[key]) acc[key] = [];
        acc[key].push(notification);
        return acc;
    }, {});

    // Sort order: Hoy -> Ayer -> Dates
    const orderedKeys = Object.keys(grouped).sort((a, b) => {
        if (a === 'Hoy') return -1;
        if (b === 'Hoy') return 1;
        if (a === 'Ayer') return -1;
        if (b === 'Ayer') return 1;
        // Specific dates check might need standard sorting if keys are localized strings
        // For now, reliance on insertion order from descending API sort usually works 
        // but strict parsing is better. Assuming API returns sorted DESC.
        return 0;
    });

    return (
        <div className="pb-20">
            {orderedKeys.map(group => (
                <div key={group}>
                    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2 border-y border-border/50 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        {group}
                    </div>
                    <div>
                        {grouped[group].map((notification: Notification) => (
                            <NotificationItem
                                key={notification.id}
                                notification={notification}
                                onRead={onRead}
                                onDelete={onDelete}
                                onOpenContext={onOpenContext}
                                isMenuOpen={contextMenu?.id === notification.id}
                                menuPosition={(contextMenu && contextMenu.id === notification.id && contextMenu.x !== undefined) ? { x: contextMenu.x, y: contextMenu.y! } : null}
                                onContextMenu={(e) => handleContextMenu(e, notification.id)}
                                onMobileMenu={(open) => handleMobileMenu(open, notification.id)}
                                onCloseMenu={handleCloseMenu}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
