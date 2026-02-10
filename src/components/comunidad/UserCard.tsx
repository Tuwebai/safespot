import { useNavigate } from 'react-router-dom';
import { UserPlus, UserCheck, MessageCircle, MapPin, BadgeCheck, Sparkles, MoreHorizontal, Tag } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, UserProfile } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar';
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
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const [isFollowing, setIsFollowing] = useState(user.is_following);
    const [isAliasDialogOpen, setIsAliasDialogOpen] = useState(false);
    const [aliasInput, setAliasInput] = useState(user.personal_alias || '');
    
    const { setAlias, removeAlias } = usePersonalAliasMutation();

    // Usar display_alias (calculado en backend) o fallback
    const displayName = user.display_alias || user.alias || 'Usuario Anónimo';
    const hasPersonalAlias = !!user.personal_alias;

    const followMutation = useMutation({
        mutationFn: () => usersApi.follow(user.anonymous_id),
        onMutate: async () => {
            // Optimistic Update
            const previousState = isFollowing;
            setIsFollowing(true);
            return { previousState };
        },
        onError: (_, __, context) => {
            setIsFollowing(context?.previousState ?? false);
            error('No se pudo seguir al usuario');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', 'global'] });
            queryClient.invalidateQueries({ queryKey: ['users', 'nearby'] });
            success(`Ahora sigues a ${displayName}`);
        },
    });

    const unfollowMutation = useMutation({
        mutationFn: () => usersApi.unfollow(user.anonymous_id),
        onMutate: async () => {
            const previousState = isFollowing;
            setIsFollowing(false);
            return { previousState };
        },
        onError: (_, __, context) => {
            setIsFollowing(context?.previousState ?? true);
            error('No se pudo dejar de seguir');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users', 'global'] });
            queryClient.invalidateQueries({ queryKey: ['users', 'nearby'] });
        },
    });

    const handleFollowToggle = () => {
        if (isFollowing) {
            unfollowMutation.mutate();
        } else {
            followMutation.mutate();
        }
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
                        src={user.avatar_url || getAvatarUrl(user.anonymous_id)}
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
                                <span className="flex items-center gap-1 text-base">
                                    <span className="text-neon-green font-bold">#</span>
                                    <span className="font-bold">{user.personal_alias}</span>
                                </span>
                                {/* Alias global - secundario */}
                                {user.global_alias && (
                                    <span className="text-[11px] text-muted-foreground/70 font-normal">
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
                        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5 mt-0.5">
                            <MapPin className="w-3 h-3" />
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
                        "h-9 px-4 min-w-[100px] transition-all duration-300",
                        isFollowing
                            ? "border-primary/20 bg-primary/10 text-primary hover:bg-destructive/10 hover:text-destructive hover:border-destructive"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                    )}
                    onClick={handleFollowToggle}
                    disabled={followMutation.isPending || unfollowMutation.isPending}
                >
                    {isFollowing ? (
                        <span className="flex items-center gap-2 group">
                            <UserCheck className="h-4 w-4 block group-hover:hidden" />
                            <span className="block group-hover:hidden">Siguiendo</span>
                            <span className="hidden group-hover:block text-destructive">Dejar</span>
                        </span>
                    ) : (
                        <span className="flex items-center gap-2">
                            <UserPlus className="h-4 w-4" />
                            Seguir
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
