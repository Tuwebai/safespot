import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usersApi } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, UserPlus, UserCheck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/components/ui/toast';
import { handleError } from '@/lib/errorHandler';
import { Badge } from '@/components/ui/badge';

interface UserListItem {
    anonymous_id: string;
    alias: string;
    avatar_url: string | null;
    level: number;
    is_following: boolean; // Or is_following_back depending on context
    is_following_back?: boolean;
}

export default function FollowsPage() {
    const { alias } = useParams<{ alias: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();

    // Determine initial tab based on URL path or state
    const initialTab = location.pathname.includes('/seguidos') ? 'following' : 'followers';
    const [activeTab, setActiveTab] = useState(initialTab);

    const [users, setUsers] = useState<UserListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [targetUserAlias, setTargetUserAlias] = useState(alias);

    const loadData = useCallback(async () => {
        if (!alias) return;
        setLoading(true);
        try {
            // Clean alias if it has @
            const identifier = alias.replace(/^@/, '');
            setTargetUserAlias(identifier);

            let data = [];
            if (activeTab === 'followers') {
                data = await usersApi.getFollowers(identifier);
            } else {
                data = await usersApi.getFollowing(identifier);
            }
            setUsers(data);
        } catch (error) {
            handleError(error, toast.error, 'FollowsPage.load');
        } finally {
            setLoading(false);
        }
    }, [alias, activeTab, toast.error]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleFollowToggle = async (user: UserListItem) => {
        // Optimistic update
        setUsers(prev => prev.map(u => {
            if (u.anonymous_id === user.anonymous_id) {
                // If we are in 'following' tab and unfollow, we might want to remove it or just change state
                // Changing state is safer for UI stability
                const newState = activeTab === 'followers'
                    ? { ...u, is_following_back: !u.is_following_back } // If list is followers, we toggle 'follow back'
                    : { ...u, is_following: !u.is_following };
                return newState;
            }
            return u;
        }));

        try {
            const isFollowing = activeTab === 'followers' ? user.is_following_back : user.is_following;

            if (isFollowing) {
                await usersApi.unfollow(user.anonymous_id);
                toast.success(`Dejaste de seguir a @${user.alias}`);
            } else {
                await usersApi.follow(user.anonymous_id);
                toast.success(`Comenzaste a seguir a @${user.alias}`);
            }
        } catch (error) {
            // Revert on error
            loadData();
            handleError(error, toast.error, 'FollowsPage.toggle');
        }
    };

    const handleTabChange = (value: string) => {
        setActiveTab(value);
        // Optional: Update URL without full reload
        const newPath = value === 'followers' ? `/usuario/@${targetUserAlias}/seguidores` : `/usuario/@${targetUserAlias}/seguidos`;
        window.history.replaceState(null, '', newPath);
    };

    // Determine current user ID safely
    const currentUserId = localStorage.getItem('anonymous_id');

    return (
        <div className="container mx-auto max-w-2xl px-4 py-6 pb-20">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(-1)}
                    className="hover:bg-transparent hover:text-neon-green"
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <div>
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        @{targetUserAlias}
                    </h1>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                    <TabsTrigger value="followers">Seguidores</TabsTrigger>
                    <TabsTrigger value="following">Seguidos</TabsTrigger>
                </TabsList>

                <div className="space-y-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-3 p-4 rounded-xl bg-card/50 border border-border animate-pulse">
                                    <div className="h-12 w-12 rounded-full bg-muted" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 w-24 bg-muted rounded" />
                                        <div className="h-3 w-16 bg-muted rounded" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Users className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            <p>No hay usuarios aquí aún.</p>
                        </div>
                    ) : (
                        users.map((user) => {
                            const isFollowing = activeTab === 'followers' ? user.is_following_back : user.is_following;

                            return (
                                <div key={user.anonymous_id} className="flex items-center justify-between p-3 rounded-xl bg-card border border-border/50 hover:border-neon-green/30 transition-colors">
                                    <div
                                        className="flex items-center gap-3 flex-1 cursor-pointer"
                                        onClick={() => navigate(`/usuario/${user.anonymous_id}`)}
                                    >
                                        <Avatar className="h-12 w-12 border border-border">
                                            <AvatarImage src={user.avatar_url || undefined} />
                                            <AvatarFallback className="bg-muted text-muted-foreground">
                                                {user.alias?.substring(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <h3 className="font-bold text-foreground">@{user.alias}</h3>
                                            <div className="flex items-center gap-2">
                                                <Badge variant="outline" className="text-[10px] h-5 px-1.5 border-neon-green/30 text-neon-green bg-neon-green/5">
                                                    LVL {user.level}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>

                                    {user.anonymous_id !== currentUserId && ( // Cannot follow self
                                        <Button
                                            size="sm"
                                            variant={isFollowing ? "outline" : "default"}
                                            className={isFollowing
                                                ? "border-border text-muted-foreground hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50"
                                                : "bg-neon-green text-black hover:bg-neon-green/90"
                                            }
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleFollowToggle(user);
                                            }}
                                        >
                                            {isFollowing ? (
                                                <UserCheck className="h-4 w-4" />
                                            ) : (
                                                <UserPlus className="h-4 w-4" />
                                            )}
                                        </Button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </Tabs>
        </div>
    );
}
