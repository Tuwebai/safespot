import { motion, PanInfo, useAnimation } from 'framer-motion';
import {
    Trash2,
    CheckCheck,
    MessageSquare,
    FileText,
    Trophy,
    Bell,
    ExternalLink,
    MoreHorizontal
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

interface NotificationItemProps {
    notification: any;
    onRead: (id: string) => void;
    onDelete: (id: string) => void;
    onOpenContext: (notification: any) => void;
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
            default: return <Bell className="w-5 h-5 text-gray-500" />;
        }
    };

    // Swipe Handler (Mobile)
    const handleDragEnd = async (_: any, info: PanInfo) => {
        if (info.offset.x < -100) {
            // Swiped Left far enough -> Show actions or trigger delete?
            // For WhatsApp style, usually it reveals buttons. 
            // We'll stick to a reveal animation state or spring back if not implemented fully as separate layer.
            // For v1 simplicity: Snap back but vibrating could hint actions. 
            // Actually, let's just use ContextMenu for primary interaction on PC 
            // and Short Tap for Read, Long Press for Context on Mobile.
            // But requirement said "Swipe showing actions".

            // Re-centering for now as custom swipe action-sheets are complex to compose inline 
            // without a dedicated wrapping container. adapting to just visual "bounce" 
            // and relying on Long Press / Menu button for reliability if native swipe is tricky.
            // HOWEVER, user asked specifically for Swipe actions.
            // Let's implement a simple "Swipe to Reveal" logic.
            await controls.start({ x: -140 }); // Reveal width
        } else {
            await controls.start({ x: 0 });
        }
    };

    const resetSwipe = () => {
        controls.start({ x: 0 });
    };

    return (
        <div className="relative overflow-hidden border-b border-border/50 group">
            {/* Background Actions (Revealed on Swipe) - Mobile Only */}
            <div className="absolute inset-y-0 right-0 w-[140px] flex md:hidden">
                <button
                    onClick={() => { onOpenContext(notification); resetSwipe(); }}
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

            <motion.div
                drag="x"
                dragConstraints={{ left: -140, right: 0 }}
                onDragEnd={handleDragEnd}
                animate={controls}
                className={cn(
                    "relative bg-card flex items-start gap-4 p-4 touch-pan-y transition-colors",
                    !notification.is_read && "bg-accent/10 hover:bg-accent/20",
                    notification.is_read && "hover:bg-accent/5",
                    "cursor-pointer"
                )}
                onClick={() => onOpenContext(notification)}
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
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => onOpenContext(notification)}>
                                <ExternalLink className="w-4 h-4 mr-2" />
                                Abrir contexto
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

            {/* Context Menu (Invisible Trigger for Right Click placement is hard with Radix, 
                so we use the controlled state from onContextMenu above bounded to a hidden trigger or 
                we just overlay strict UI. 
                Using a hidden trigger at cursor position is tricky. 
                A simpler approach for "WhatsApp Desktop" feel: 
                Just show the chevron on hover for desktop, and let standard click work.
                But user asked for Right Click. 
                We will use the same Dropdown logic but trigger it differently? 
                Actually, standard Radix dropdown is click-triggered. 
                Right-click custom menus in React usually require a custom position state.
                For MVP/Robustness: We'll stick to the "More" button visible on hover (Desktop) / always (Mobile) 
                AND allow Right-Click to open the same menu if possible, or just rely on the button 
                as standard web behavior is safer.
                
                User Rule: "Right Click (PC) -> Context Menu".
                
                Let's add a `ContextMenu` wrapper from Radix or Shadcn if available? 
                Checking imports... I don't see `ContextMenu` in imports, only `DropdownMenu`.
                I will simulate it with the `isMenuOpen` state and positioning if I had coordinates, 
                but simpler is to just Open the DropdownMenu normally centered or at list item corner.
             */}

            {/* Invisible trigger attached to cursor coordinates for Right Click context */}
            {isMenuOpen && menuPosition && (
                <DropdownMenu open={isMenuOpen} onOpenChange={(open) => !open && onCloseMenu()}>
                    <DropdownMenuTrigger
                        className="fixed w-1 h-1 opacity-0 pointer-events-none"
                        style={{ top: menuPosition.y, left: menuPosition.x }}
                    >
                        .
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={() => onOpenContext(notification)}>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Abrir contexto
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
