import { useNavigate } from 'react-router-dom';
import { UserPlus, UserCheck, MessageCircle, MapPin, BadgeCheck, Sparkles, MoreHorizontal, Tag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';

import type { UserProfile } from '@/lib/api';
import { useFollowMutation } from '@/hooks/mutations/useFollowMutation';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { getAvatarFallback, resolveAvatarUrl } from '@/lib/avatar';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { differenceInDays } from 'date-fns';
import { usePersonalAliasMutation } from '@/hooks/mutations/usePersonalAliasMutation';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AliasEditModal } from '@/components/ui/AliasEditModal';

interface UserCardProps {
    user: UserProfile;
    showLocation?: boolean;
    style?: React.CSSProperties;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: () => void;
    onMouseMove?: (e: React.MouseEvent) => void;
}

/**
 * Formatea tiempo de actividad relativo
 */
function formatActivity(lastActive?: string): string | null {
    if (!lastActive) return null;
    try {
        const date = new Date(lastActive);
        const now = new Date();
        const diffMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
        
        if (diffMinutes < 5) return '🟢 Ahora';
        if (diffMinutes < 60) return `🟢 Hace ${diffMinutes} min`;
        
        return `🟢 ${formatDistanceToNow(date, { addSuffix: true, locale: es })}`;
    } catch {
        return null;
    }
}

export function UserCard({ 
    user, 
    showLocation = false, 
    style,
    onMouseEnter,
    onMouseLeave,
    onMouseMove
}: UserCardProps) {
    // 🏛️ DEFENSIVE: Validate user data
    if (!user?.anonymous_id) {
        console.warn('[UserCard] Missing anonymous_id for user:', user);
        return null;
    }
    
    const navigate = useNavigate();

    const { success, error } = useToast();
    const [isFollowing, setIsFollowing] = useState(user.is_following);
    const [isAliasDialogOpen, setIsAliasDialogOpen] = useState(false);
    const [aliasInput, setAliasInput] = useState(user.personal_alias || '');
    
    const { setAlias, removeAlias } = usePersonalAliasMutation();

    // Usar display_alias (calculado en backend) o fallback
    const displayName = user.display_alias || user.alias || 'Usuario Anónimo';
    const hasPersonalAlias = !!user.personal_alias;

    const followMutation = useFollowMutation();

    useEffect(() => {
        setIsFollowing(user.is_following);
    }, [user.is_following]);

    const handleFollowToggle = () => {
        const nextFollowing = !isFollowing;
        setIsFollowing(nextFollowing);

        followMutation.mutate(
            { anonymousId: user.anonymous_id, action: isFollowing ? 'unfollow' : 'follow' },
            {
                onSuccess: () => {
                    if (nextFollowing) {
                        success(`Ahora sigues a ${displayName}`);
                    }
                },
                onError: () => {
                    setIsFollowing(!nextFollowing);
                    error(isFollowing ? 'No se pudo dejar de seguir' : 'No se pudo seguir al usuario');
                }
            }
        );
    };

    const handleMessage = () => {
        navigate(`/mensajes?userId=${user.anonymous_id}`);
    };

    const handleProfileClick = () => {
        if (user.alias) {
            navigate(`/usuario/${user.alias}`);
        }
    };

    return (
        <div 
            className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in duration-300 hover:border-neon-green/20 transition-colors user-card"
            style={style}
            onMouseEnter={isAliasDialogOpen ? undefined : onMouseEnter}
            onMouseLeave={isAliasDialogOpen ? undefined : onMouseLeave}
            onMouseMove={isAliasDialogOpen ? undefined : onMouseMove}
        >
            <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={handleProfileClick}
            >
                <Avatar className="h-12 w-12 border-2 border-transparent group-hover:border-neon-green transition-colors">
                    <AvatarImage
                        src={resolveAvatarUrl(user, user.anonymous_id)}
                        alt={user.alias || 'Usuario'}
                        referrerPolicy="no-referrer" // Important for Google Images
                    />
                    <AvatarFallback className="bg-muted text-foreground/50">
                        {getAvatarFallback(user.alias)}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-col min-w-0">
                    <span className="font-semibold text-foreground group-hover:text-neon-green transition-colors flex items-center gap-1.5">
                        {hasPersonalAlias ? (
                            <span className="flex flex-col">
                                {/* Alias personal - destacado */}
                                <span className="flex items-center gap-1 text-sm sm:text-base">
                                    <span className="text-neon-green font-bold">#</span>
                                    <span className="font-bold truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]" title={user.personal_alias || undefined}>
                                        {user.personal_alias}
                                    </span>
                                </span>
                                {/* Alias global - secundario */}
                                {user.global_alias && (
                                    <span 
                                        className="text-[11px] text-muted-foreground/70 font-normal truncate max-w-[100px] sm:max-w-[150px] md:max-w-[200px]"
                                        title={`@${user.global_alias}`}
                                    >
                                        @{user.global_alias}
                                    </span>
                                )}
                            </span>
                        ) : (
                            <span>{user.global_alias || 'Usuario Anónimo'}</span>
                        )}
                        {user.is_official && (
                            <span title="Cuenta verificada">
                                <BadgeCheck className="w-4 h-4 text-blue-500" aria-label="Verificado" />
                            </span>
                        )}
                        {/* Solo badge nuevo usuario */}
                        {differenceInDays(new Date(), new Date(user.created_at)) <= 7 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0 rounded text-[9px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30">
                                <Sparkles className="w-2.5 h-2.5" />
                                Nuevo
                            </span>
                        )}
                    </span>
                    
                    <span className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap mt-0.5">
                        <span>Nivel {user.level} • {user.points} pts</span>
                        {formatActivity(user.last_active_at) && (
                            <span className="text-neon-green/80">{formatActivity(user.last_active_at)}</span>
                        )}
                    </span>
                    {showLocation && user.current_city && (
                        <span 
                            className="text-xs text-muted-foreground/60 flex items-center gap-0.5 mt-0.5 hidden sm:flex truncate max-w-[200px]"
                            title={user.current_city}
                        >
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {user.current_city}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {/* Menú de alias personal */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-muted-foreground hover:text-foreground"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setIsAliasDialogOpen(true)}>
                            <Tag className="w-4 h-4 mr-2" />
                            {hasPersonalAlias ? 'Editar alias' : 'Agregar alias'}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-neon-green hover:border-neon-green"
                    onClick={handleMessage}
                >
                    <MessageCircle className="h-4 w-4" />
                </Button>

                <Button
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className={cn(
                        "h-8 sm:h-9 px-2 sm:px-4 min-w-[80px] sm:min-w-[100px] transition-all duration-300 text-xs sm:text-sm",
                        isFollowing
                            ? "border-primary/20 bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    )}
                    onClick={handleFollowToggle}
                    disabled={followMutation.isPending}
                >
                    {isFollowing ? (
                        <span className="flex items-center gap-1 sm:gap-2 group">
                            <UserCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4 block group-hover:hidden" />
                            <span className="block group-hover:hidden">Siguiendo</span>
                            <span className="hidden group-hover:block text-destructive">Dejar</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-1 sm:gap-2">
                            <UserPlus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            <span className="hidden sm:inline">Seguir</span>
                            <span className="sm:hidden">Seguir</span>
                        </span>
                    )}
                </Button>
            </div>

            {/* Modal para editar alias */}
            <AliasEditModal
                isOpen={isAliasDialogOpen}
                onClose={() => setIsAliasDialogOpen(false)}
                onSave={(alias) => {
                    setAlias(user.anonymous_id, alias);
                    setIsAliasDialogOpen(false);
                }}
                onRemove={() => {
                    removeAlias(user.anonymous_id);
                    setAliasInput('');
                    setIsAliasDialogOpen(false);
                }}
                initialAlias={aliasInput}
                targetName={user.global_alias || 'este usuario'}
                hasExistingAlias={hasPersonalAlias}
            />
        </div>
    );
}
