import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotificationsQuery } from '@/hooks/queries/useNotificationsQuery';

export function NotificationBell() {
    const { data: notifications = [] } = useNotificationsQuery();
    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <Link to="/notificaciones" className="relative p-2 text-foreground/70 hover:text-neon-green transition-colors">
            <Bell className="h-6 w-6" />
            {unreadCount > 0 && (
                <span className={cn(
                    "absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-dark-card animate-in zoom-in duration-300",
                    unreadCount > 9 && "w-6 h-6 -right-1"
                )}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </Link>
    );
}
