import { useNavigate } from 'react-router-dom';
import { UserPlus, UserCheck, MessageCircle } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, UserProfile } from '@/lib/api';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface UserCardProps {
    user: UserProfile;
}

export function UserCard({ user }: UserCardProps) {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { success, error } = useToast();
    const [isFollowing, setIsFollowing] = useState(user.is_following);

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
            success(`Ahora sigues a ${user.alias || 'Usuario'}`);
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
        navigate('/mensajes');
    };

    const handleProfileClick = () => {
        if (user.alias) {
            navigate(`/usuario/${user.alias}`);
        }
    }

    return (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-between gap-4 animate-in fade-in duration-300">
            <div
                className="flex items-center gap-3 cursor-pointer group"
                onClick={handleProfileClick}
            >
                <Avatar className="h-12 w-12 border-2 border-transparent group-hover:border-neon-green transition-colors">
                    <AvatarImage
                        src={user.avatar_url || undefined}
                        alt={user.alias || 'Usuario'}
                        referrerPolicy="no-referrer" // Important for Google Images
                    />
                    <AvatarFallback className="bg-muted text-foreground/50">
                        {user.alias ? user.alias.substring(0, 2).toUpperCase() : 'AN'}
                    </AvatarFallback>
                </Avatar>

                <div className="flex flex-col">
                    <span className="font-semibold text-foreground group-hover:text-neon-green transition-colors">
                        {user.alias || 'Usuario Anónimo'}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                        Nivel {user.level} • {user.points} pts
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-2">
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
        </div>
    );
}
