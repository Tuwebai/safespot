/**
 * 🏛️ SAFE MODE: UserPreview - Hover Preview Enterprise
 * 
 * Tarjeta flotante con información detallada del usuario.
 * Reutiliza patrón del Admin UsersPage.
 * 
 * @version 1.0 - Enterprise Hover Preview
 */

import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { 
    Award, 
    FileText, 
    MessageSquare, 
    Calendar, 
    MapPin,
    Users,
    TrendingUp,
    BadgeCheck,
    Sparkles
} from 'lucide-react';
import type { UserProfile } from '@/lib/api';
import { getAvatarUrl } from '@/lib/avatar';
import { differenceInDays } from 'date-fns';

interface UserPreviewProps {
    user: UserProfile;
    x: number;
    y: number;
    visible: boolean;
}

export function UserPreview({ user, x, y, visible }: UserPreviewProps) {
    const boxWidth = 300;
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        
        const screenWidth = window.innerWidth;
        const screenHeight = window.innerHeight;
        const margin = 20;

        // Calcular posición basada en cuadrante de pantalla
        const isBottomHalf = y > screenHeight / 2;
        const isRightHalf = x > screenWidth / 2;

        let newX = x;
        let newY = y;

        // Horizontal: Si está en la mitad derecha, mostrar a la izquierda del cursor
        if (isRightHalf) {
            newX = Math.max(margin, x - boxWidth - 20);
        } else {
            newX = Math.min(x + 20, screenWidth - boxWidth - margin);
        }

        // Vertical: Si está en la mitad inferior, mostrar arriba del cursor
        if (isBottomHalf) {
            newY = y - 350; // Altura estimada del preview
            if (newY < margin) newY = margin;
        } else {
            newY = y + 20;
        }

        setPosition({ x: newX, y: newY });
    }, [x, y]);

    if (!mounted || !visible) return null;

    return createPortal(
        <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            style={{
                position: 'fixed',
                left: position.x,
                top: position.y,
                width: boxWidth,
                zIndex: 9999,
                pointerEvents: 'none'
            }}
            className="bg-card/98 backdrop-blur-xl border border-neon-green/30 rounded-2xl p-5 shadow-2xl overflow-hidden"
        >
            {/* Header / Avatar */}
            <div className="flex items-center gap-4 mb-4">
                <div className="h-16 w-16 rounded-2xl bg-muted border border-neon-green/20 flex items-center justify-center overflow-hidden shrink-0">
                    <img
                        src={user.avatar_url || getAvatarUrl(user.anonymous_id)}
                        alt={user.alias || 'Usuario'}
                        className="h-full w-full object-cover"
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-foreground font-bold text-lg truncate flex items-center gap-1.5">
                        {user.alias || 'Usuario Anónimo'}
                        {user.is_official && (
                            <span title="Cuenta verificada">
                                <BadgeCheck className="w-5 h-5 text-blue-500" aria-label="Verificado" />
                            </span>
                        )}
                    </h3>
                    <div className="flex items-center gap-2 text-neon-green text-xs font-bold uppercase tracking-wider">
                        <Award className="h-3 w-3" />
                        Nivel {user.level}
                        {/* Solo badge nuevo usuario */}
                        {differenceInDays(new Date(), new Date(user.created_at)) <= 7 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                <Sparkles className="w-2.5 h-2.5" />
                                Nuevo
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-muted/50 rounded-xl p-3 border border-border">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Puntos
                    </div>
                    <div className="text-xl font-bold text-foreground">
                        {user.points?.toLocaleString() || 0}
                    </div>
                </div>
                <div className="bg-muted/50 rounded-xl p-3 border border-border">
                    <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        Reportes
                    </div>
                    <div className="text-xl font-bold text-foreground">
                        {user.total_reports || 0}
                    </div>
                </div>
            </div>

            {/* Activity Feed Mini */}
            <div className="space-y-2">
                <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest px-1">
                    Actividad
                </div>
                <div className="bg-background/50 rounded-xl p-3 space-y-2 border border-border">
                    <div className="flex items-center gap-3 text-xs">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
                        <span className="text-muted-foreground">Comentarios:</span>
                        <span className="ml-auto font-mono text-foreground">{user.total_comments || 0}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                        <Users className="h-3.5 w-3.5 text-purple-400" />
                        <span className="text-muted-foreground">Votos:</span>
                        <span className="ml-auto font-mono text-foreground">{user.total_votes || 0}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs pt-1 border-t border-border">
                        <Calendar className="h-3.5 w-3.5 text-orange-400" />
                        <span className="text-muted-foreground">Miembro:</span>
                        <span className="ml-auto whitespace-nowrap text-muted-foreground text-[10px]">
                            {new Date(user.created_at).toLocaleDateString('es-AR', { month: 'short', year: 'numeric' })}
                        </span>
                    </div>
                    {user.current_city && (
                        <div className="flex items-center gap-3 text-xs pt-1 border-t border-border">
                            <MapPin className="h-3.5 w-3.5 text-neon-green" />
                            <span className="text-muted-foreground">Ubicación:</span>
                            <span className="ml-auto whitespace-nowrap text-muted-foreground text-[10px]">
                                {user.current_city}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* Last Active */}
            <div className="mt-3 text-center">
                <span className="text-[10px] text-muted-foreground">
                    Activo {formatDistanceToNow(new Date(user.last_active_at), { addSuffix: true, locale: es })}
                </span>
            </div>

            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-neon-green/5 rounded-full blur-3xl -mr-12 -mt-12 pointer-events-none" />
        </motion.div>,
        document.body
    );
}

// Hook para manejar el hover
export function useUserPreview() {
    const [hoveredUser, setHoveredUser] = useState<{ user: UserProfile; x: number; y: number } | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleMouseEnter = (user: UserProfile) => (e: React.MouseEvent) => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        hoverTimeoutRef.current = setTimeout(() => {
            setHoveredUser({ user, x: e.clientX, y: e.clientY });
        }, 50);
    };

    const handleMouseLeave = () => {
        if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        setHoveredUser(null);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (hoveredUser) {
            setHoveredUser(prev => prev ? { ...prev, x: e.clientX, y: e.clientY } : null);
        }
    };

    useEffect(() => {
        return () => {
            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
        };
    }, []);

    return {
        hoveredUser,
        handleMouseEnter,
        handleMouseLeave,
        handleMouseMove,
        UserPreviewComponent: hoveredUser ? (
            <UserPreview 
                user={hoveredUser.user} 
                x={hoveredUser.x} 
                y={hoveredUser.y} 
                visible={!!hoveredUser}
            />
        ) : null
    };
}
