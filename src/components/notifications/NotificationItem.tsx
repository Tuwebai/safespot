import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, PanInfo, useAnimation } from 'framer-motion';
import {
    Trash2,
    CheckCheck,
    MessageSquare,
    FileText,
    Trophy,
    Bell,
    ExternalLink,
    MoreHorizontal,
    User,
    MapPin,
    Users,
    Zap,
    Settings
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import type { Notification } from '@/lib/api';
import { resolveNotificationNavigation } from '@/utils/notificationNavigation';

interface NotificationItemProps {
    notification: Notification;
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
    onOpenContext: (notification: Notification) => void;
    isMenuOpen: boolean;
    menuPosition: { x: number; y: number } | null;
    onContextMenu: (e: React.MouseEvent) => void;
    onMobileMenu: (open: boolean) => void;
    onCloseMenu: () => void;
}

export function NotificationItem({
    notification,
    onRead,
    onDelete,
    onOpenContext,
    isMenuOpen,
    menuPosition,
    onContextMenu,
    onMobileMenu,
    onCloseMenu
}: NotificationItemProps) {
    const controls = useAnimation();
    const [isSwiping, setIsSwiping] = useState(false);
    const wasSwipingRef = useRef(false);
    const navigate = useNavigate();

    // Context Badge Logic
    const getContextBadge = () => {
        if (!notification.metadata?.motive) return null;

        const { motive, zone_type, action_label } = notification.metadata;
        
        // Helper for badge rendering
        const Badge = ({ icon: Icon, text, onClick }: { icon: any, text: string, onClick?: (e: React.MouseEvent) => void }) => (
            <div 
                onClick={(e) => {
                    e.stopPropagation();
                    onClick?.(e);
                }}
                className={cn(
                    "flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border w-fit mt-1.5 transition-colors cursor-pointer",
                    "bg-secondary/30 border-secondary/50 text-secondary-foreground hover:bg-secondary/50",
                    !onClick && "cursor-default hover:bg-secondary/30"
                )}
            >
                <Icon className="w-3 h-3" />
                <span>{text}</span>
            </div>
        );

        if (motive === 'proximity') {
            const zoneLabel = zone_type === 'home' ? 'Casa' : 
                              zone_type === 'work' ? 'Trabajo' : 
                              zone_type === 'custom' ? 'Zona Personal' : 'Cerca tuyo';
            return <Badge icon={MapPin} text={action_label || zoneLabel} />;
        }

        if (motive === 'similar') {
            return <Badge icon={Zap} text={action_label || "Reporte Similar"} />;
        }

        if (motive === 'social') {
            return <Badge icon={Users} text={action_label || "Social"} />;
        }

        if (motive === 'system') {
            return <Badge icon={Settings} text={action_label || "Sistema"} onClick={() => navigate('/settings')} />;
        }
        
        if (motive === 'gamification') {
            return <Badge icon={Trophy} text={action_label || "Insignia"} />;
        }

        return null;
    };

    // Icon & Color Logic
    const getIcon = () => {
        switch (notification.type) {
            case 'achievement': return <Trophy className="w-5 h-5 text-yellow-500" />;
            case 'activity':
            case 'reply':
            case 'mention':
            case 'comment': return <MessageSquare className="w-5 h-5 text-blue-500" />;
            case 'report':
            case 'proximity':
            case 'similar':
            case 'zone': return <FileText className="w-5 h-5 text-red-500" />;
            case 'user':
            case 'follow': return <User className="w-5 h-5 text-neon-green" />;
            default: return <Bell className="w-5 h-5 text-gray-500" />;
        }
    };

    // BUG 1,5,6 FIX: Only activate swipe on intentional horizontal drag
    const handleDragStart = (_: unknown, info: PanInfo) => {
        const isHorizontalSwipe = Math.abs(info.offset.x) > 10 &&
            Math.abs(info.offset.x) > Math.abs(info.offset.y);
        if (isHorizontalSwipe) {
            setIsSwiping(true); // BUG 1/5/6 FIX: Activar estado swipe
            wasSwipingRef.current = true;
        }
    };

    // Swipe Handler (Mobile)
    const handleDragEnd = async (_: unknown, info: PanInfo) => {
        if (isSwiping && info.offset.x < -100) {
            await controls.start({ x: -140 }); // Reveal width
        } else {
            await controls.start({ x: 0 });
            setIsSwiping(false); // BUG 1/5/6 FIX: Ocultar si no hay swipe suficiente
        }
    };

    const resetSwipe = () => {
        controls.start({ x: 0 });
        setIsSwiping(false); // BUG 1/5/6 FIX: Resetear estado
    };

    // BUG 6 FIX: Guard click if we were swiping
    const handleClick = () => {
        if (wasSwipingRef.current) {
            wasSwipingRef.current = false;
            return;
        }
        
        const targetPath = resolveNotificationNavigation(notification);
        
        // 🧠 NAVEGACIÓN INTELIGENTE
        // Si el helper no encuentra un destino específico (devuelve default),
        // usamos el comportamiento original (modal/contexto).
        if (targetPath === '/notificaciones') {
            onOpenContext(notification);
        } else {
            navigate(targetPath);
            onRead(notification.id);
        }
    };

    return (
        <div className="relative overflow-hidden border-b border-border/50 group">
            {/* Background Actions (Revealed on Swipe) - Mobile Only */}
            {/* BUG 1/5/6 FIX: Solo visible cuando isSwiping=true */}
            {isSwiping && (
                <div className="absolute inset-y-0 right-0 w-[140px] flex md:hidden">
                    <button
                        onClick={() => { handleClick(); resetSwipe(); }} // Use handleClick semantics
                        className="flex-1 bg-blue-600 flex items-center justify-center text-white"
                    >
                        <ExternalLink className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => { onDelete(notification.id); resetSwipe(); }}
                        className="flex-1 bg-red-600 flex items-center justify-center text-white"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>
            )}

            <motion.div
                drag="x"
                dragConstraints={{ left: -140, right: 0 }}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                animate={controls}
                className={cn(
                    "relative bg-card flex items-start gap-4 p-4 touch-pan-y transition-colors",
                    !notification.is_read && "bg-accent/10 hover:bg-accent/20",
                    notification.is_read && "hover:bg-accent/5",
                    "cursor-pointer"
                )}
                onClick={handleClick}
                onContextMenu={onContextMenu}
            >
                {/* Icon */}
                <div className="mt-1 shrink-0 p-2 bg-background rounded-full border border-border">
                    {getIcon()}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className={cn("text-sm font-semibold pr-2", !notification.is_read ? "text-foreground" : "text-muted-foreground")}>
                            {notification.title}
                        </h4>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: es })}
                        </span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                        {notification.message}
                    </p>
                    {getContextBadge()}
                </div>

                {/* Unread Dot */}
                {!notification.is_read && (
                    <div className="self-center w-2.5 h-2.5 rounded-full bg-neon-green shrink-0 animate-pulse" />
                )}

                {/* Force Menu Trigger for Desktop if Right Click missed or Mobile */}
                <div className="absolute top-2 right-2 md:hidden">
                    <DropdownMenu open={isMenuOpen && !menuPosition} onOpenChange={onMobileMenu}>
                        <DropdownMenuTrigger asChild>
                            <button className="p-1 text-muted-foreground/50 hover:text-foreground">
                                <MoreHorizontal className="w-4 h-4" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-card border border-border shadow-xl">
                            <DropdownMenuItem onClick={handleClick}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onRead(notification.id)}>
                                <CheckCheck className="w-4 h-4 mr-2" />
                                Marcar como leída
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => onDelete(notification.id)}>
                                <Trash2 className="w-4 h-4 mr-2" />
                                Eliminar
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </motion.div>

            {/* Hidden/Custom Context Menu */}
            {isMenuOpen && menuPosition && (
                <DropdownMenu open={isMenuOpen} onOpenChange={(open) => !open && onCloseMenu()}>
                    <DropdownMenuTrigger
                        className="fixed w-1 h-1 opacity-0 pointer-events-none"
                        style={{ top: menuPosition.y, left: menuPosition.x }}
                    >
                        .
                    </DropdownMenuTrigger>
                    {/* BUG 7 FIX: Fondo opaco */}
                    <DropdownMenuContent align="start" className={`bg-popover border border-border shadow-xl z-[75]`}>
                        <DropdownMenuItem onClick={handleClick}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onRead(notification.id)}>
                            {notification.is_read ? (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2 opacity-50" />
                                    <span>Ya leída</span>
                                </>
                            ) : (
                                <>
                                    <CheckCheck className="w-4 h-4 mr-2" />
                                    <span>Marcar como leída</span>
                                </>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => onDelete(notification.id)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Eliminar
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            )}
        </div>
    );
}
