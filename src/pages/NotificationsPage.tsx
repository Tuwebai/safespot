import { useNavigate } from 'react-router-dom';
import { Bell, Check, Clock, MessageCircle, Eye, Share2, AlertTriangle, ChevronRight, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Notification } from '@/lib/api';
import { useNotificationsQuery, useMarkNotificationReadMutation, useMarkAllNotificationsReadMutation } from '@/hooks/queries/useNotificationsQuery';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';




export default function NotificationsPage() {
    const navigate = useNavigate();
    const { data: notifications = [], isLoading: loading } = useNotificationsQuery();
    const markAsReadMutation = useMarkNotificationReadMutation();
    const markAllReadMutation = useMarkAllNotificationsReadMutation();

    // Push Notification Logic
    const { isSupported, isSubscribed, subscribe, permission } = usePushNotifications();



    const handleMarkAsRead = async (id: string) => {
        markAsReadMutation.mutate(id);
    };

    const handleMarkAllAsRead = async () => {
        markAllReadMutation.mutate();
    };

    const handleNotificationClick = async (notif: Notification) => {
        if (!notif.is_read) {
            handleMarkAsRead(notif.id);
        }

        // DEBUG: Trace notification click
        console.log("[Notification Click]", {
            notificationId: notif.id,
            reportId: notif.report_id,
            entityId: notif.entity_id,
            type: notif.type,
            entityType: notif.entity_type
        });

        // 1. Handle Navigation by Type
        if (notif.type === 'achievement' || notif.entity_type === 'badge') {
            navigate('/perfil'); // Badges are shown in profile
            return;
        }

        if (notif.type === 'follow') {
            console.log('[Notification] Handling follow click:', notif);
            if (notif.entity_id) {
                // entity_id is the follower's UUID
                navigate(`/usuario/${notif.entity_id}`);
            } else {
                console.warn('[Notification] Missing entity_id for follow notification, redirecting to own profile');
                navigate('/perfil');
            }
            return;
        }

        // 2. Default: Report Navigation
        const targetReportId = notif.report_id || (notif.entity_type === 'report' ? notif.entity_id : null);

        if (targetReportId) {
            navigate(`/reporte/${targetReportId}`);
        } else {
            console.warn('[Notification] No navigation target found', notif);
        }
    };

    const getIcon = (type: string, entityType: string) => {
        if (type === 'proximity') return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
        if (type === 'similar') return <Bell className="h-5 w-5 text-blue-500" />;

        switch (entityType) {
            case 'comment': return <MessageCircle className="h-5 w-5 text-neon-green" />;
            case 'sighting': return <Eye className="h-5 w-5 text-purple-500" />;
            case 'share': return <Share2 className="h-5 w-5 text-blue-400" />;
            default: return <Bell className="h-5 w-5 text-muted-foreground" />;
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    // Logic to show banner
    const showPushBanner = isSupported && !isSubscribed && permission !== 'denied';

    return (
        <div className="container mx-auto max-w-2xl px-4 py-8">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-neon-green/10">
                        <Bell className="h-6 w-6 text-neon-green" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Notificaciones</h1>
                        {unreadCount > 0 && (
                            <p className="text-sm text-muted-foreground">Tenés {unreadCount} sin leer</p>
                        )}
                    </div>
                </div>
                <div className="flex gap-2">
                    {/* TEST BUTTON - VISIBLE IF SUBSCRIBED */}


                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/perfil#notificaciones')}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Settings className="h-4 w-4 mr-2" />
                        Ajustes
                    </Button>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleMarkAllAsRead}
                            className="text-neon-green hover:bg-neon-green/10"
                        >
                            <Check className="h-4 w-4 mr-2" />
                            Leer todo
                        </Button>
                    )}
                </div>
            </div>

            {/* PUSH SUBSCRIPTION BANNER */}
            {showPushBanner && (
                <Card className="mb-6 bg-gradient-to-r from-neon-green/10 to-transparent border-neon-green/30 animate-in fade-in slide-in-from-top-4">
                    <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <div>
                            <h3 className="font-bold text-foreground flex items-center gap-2">
                                <Bell className="h-4 w-4 text-neon-green fill-neon-green" />
                                Activar Alertas en tu Dispositivo
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                                Recibí avisos de seguridad cercanos incluso con la app cerrada.
                            </p>
                        </div>
                        <Button
                            size="sm"
                            onClick={() => subscribe()}
                            className="neon-glow bg-neon-green text-dark-bg hover:bg-neon-green/90 font-bold whitespace-nowrap w-full sm:w-auto"
                        >
                            Activar Ahora
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ERROR BANNER FOR DENIED PERMISSION */}
            {permission === 'denied' && (
                <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200 flex gap-3 items-start">
                    <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
                    <p>
                        Las notificaciones están bloqueadas en tu navegador.
                        Para recibirlas, hacé clic en el candado 🔒 de la barra de dirección y permití "Notificaciones".
                    </p>
                </div>
            )}

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="animate-pulse bg-dark-card border-dark-border">
                            <CardContent className="h-24" />
                        </Card>
                    ))}
                </div>
            ) : notifications.length === 0 ? (
                <Card className="bg-dark-card border-dashed border-dark-border">
                    <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="p-4 rounded-full bg-dark-bg mb-4">
                            <Bell className="h-10 w-10 text-muted-foreground opacity-20" />
                        </div>
                        <h3 className="text-lg font-medium text-foreground mb-1">Nada por aquí</h3>
                        <p className="text-muted-foreground max-w-xs">
                            Todavía no tenés notificaciones. Activá las alertas en ajustes para estar al tanto.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-3">
                    {notifications.map((notif) => (
                        <Card
                            key={notif.id}
                            className={cn(
                                "cursor-pointer transition-all hover:border-dark-border/80 group overflow-hidden",
                                notif.is_read ? "bg-dark-card border-dark-border/50" : "bg-dark-card border-neon-green/30 shadow-lg shadow-neon-green/5"
                            )}
                            onClick={() => handleNotificationClick(notif)}
                        >
                            <CardContent className="p-0">
                                <div className="flex items-start p-4 gap-4">
                                    <div className={cn(
                                        "mt-1 p-2 rounded-lg bg-dark-bg border border-dark-border",
                                        !notif.is_read && "border-neon-green/20"
                                    )}>
                                        {getIcon(notif.type, notif.entity_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2 mb-1">
                                            <h3 className={cn(
                                                "font-semibold truncate text-sm",
                                                notif.is_read ? "text-foreground/80" : "text-foreground"
                                            )}>
                                                {notif.title}
                                            </h3>
                                            <span className="text-[10px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                                                <Clock className="h-3 w-3" />
                                                {formatDistanceToNow(new Date(notif.created_at), { addSuffix: true, locale: es })}
                                            </span>
                                        </div>
                                        <p className={cn(
                                            "text-sm line-clamp-2",
                                            notif.is_read ? "text-muted-foreground" : "text-foreground/90"
                                        )}>
                                            {notif.message}
                                        </p>
                                    </div>
                                    {!notif.is_read && (
                                        <div className="w-2 h-2 rounded-full bg-neon-green mt-2" />
                                    )}
                                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-2 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
}
