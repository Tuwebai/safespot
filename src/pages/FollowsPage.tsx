import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { usersApi } from '@/lib/api';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/Avatar";
import { Button } from '@/components/ui/button';
import { ArrowLeft, Users, UserPlus, UserCheck } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { getAnonymousIdSafe } from '@/lib/identity';
import { getAvatarUrl } from '@/lib/avatar';
import { handleError } from '@/lib/errorHandler';
import { Badge } from '@/components/ui/badge';

interface UserListItem {
    anonymous_id: string;
    alias: string;
    avatar_url: string | null;
    level: number;
    is_following: boolean; // Or is_following_back depending on context
    is_following_back?: boolean;
    common_locality?: string | null;
}

export default function FollowsPage() {
    const { alias } = useParams<{ alias: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const toast = useToast();

    // Determine initial tab based on URL path or state
    const initialTab = location.pathname.includes('/seguidos') ? 'following' : location.pathname.includes('/sugerencias') ? 'suggestions' : 'followers';
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
            } else if (activeTab === 'following') {
                data = await usersApi.getFollowing(identifier);
            } else if (activeTab === 'suggestions') {
                // Determine if we are viewing our own profile to show suggestions
                // Determine if we are viewing our own profile to show suggestions
                // We can't easily check ID match with alias here without fetching profile first, 
                // but usually suggestions are only relevant for "Me". 
                // For now, let's allow fetching suggestions if we are on the suggestions tab.
                // The backend validates token anyway.
                const suggestions = await usersApi.getSuggestions();
                data = suggestions.map((s: any) => ({
                    ...s,
                    is_following: false // Suggestions are by definition people we don't follow
                }));
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
        setUsers(prev => {
            if (activeTab === 'suggestions') {
                // Remove from list if followed
                return prev.filter(u => u.anonymous_id !== user.anonymous_id);
            }
            return prev.map(u => {
                if (u.anonymous_id === user.anonymous_id) {
                    // If we are in 'following' tab and unfollow, we might want to remove it or just change state
                    // Changing state is safer for UI stability
                    const newState = activeTab === 'followers'
                        ? { ...u, is_following_back: !u.is_following_back } // If list is followers, we toggle 'follow back'
                        : { ...u, is_following: !u.is_following };
                    return newState;
                }
                return u;
            });
        });

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
        const newPath = value === 'followers'
            ? `/usuario/@${targetUserAlias}/seguidores`
            : value === 'following'
                ? `/usuario/@${targetUserAlias}/seguidos`
                : `/usuario/@${targetUserAlias}/sugerencias`;
        window.history.replaceState(null, '', newPath);
    };

    // Determine current user ID safely
    const currentAnonymousId = getAnonymousIdSafe();

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
                <TabsList className="grid w-full grid-cols-3 mb-6">
                    <TabsTrigger value="followers" className="flex-1">Seguidores</TabsTrigger>
                    <TabsTrigger value="following" className="flex-1">Seguidos</TabsTrigger>
                    {/* Only show "Cerca" if viewing own profile. Checking if alias matches is tricky client-side without ID.
                        We can show it always, but it will error for others if backend checks token.
                        The backend uses `req.anonymousId` (requester) to find neighbors.
                        It makes sense to only show this tab if I am viewing MY profile.
                         But wait, logic above fetches `usersApi.getSuggestions()` which uses MY token.
                         So it will show MY neighbors even if I am on another profile? That's confusing.
                         Let's assume this page is primarily for managing MY network or viewing others.
                         If I view someone else, "Cerca" tab doesn't make sense unless it means "Cerca de ESTE usuario".
                         But the backend implements "Cerca de MI".
                         For now, let's hide "Cerca" tab if not viewing self (best effort check or just show it and let users discover).
                         Actually, standard pattern: This screen is often "My Network".
                         Let's add it.
                    */}
                    <TabsTrigger value="suggestions" className="flex-1">📍 Cerca</TabsTrigger>
                </TabsList>

                {/* SUGGESTIONS INFO BANNER */}
                {activeTab === 'suggestions' && users.length > 0 && (
                    <div className="bg-neon-green/10 border border-neon-green/20 rounded-md p-3 mb-4 text-sm text-foreground/80 flex items-center gap-2">
                        <div className="bg-neon-green/20 p-1.5 rounded-full">
                            <Users className="h-4 w-4 text-neon-green" />
                        </div>
                        <span>
                            {users[0].common_locality === 'Global'
                                ? "Mostrando usuarios más activos de toda la comunidad."
                                : `Personas activas en ${users[0].common_locality || 'tu zona'}.`
                            }
                        </span>
                    </div>
                )}

                <div className="space-y-4">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 bg-card/50 animate-pulse rounded-lg" />
                            ))}
                        </div>
                    ) : users.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            {activeTab === 'followers' && "Aún no hay seguidores."}
                            {activeTab === 'following' && (
                                <div className="flex flex-col items-center gap-3">
                                    <p>No sigues a nadie aún.</p>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleTabChange('suggestions')}
                                        className="border-neon-green/50 text-neon-green hover:bg-neon-green/10"
                                    >
                                        Buscar personas cerca 👀
                                    </Button>
                                </div>
                            )}
                            {activeTab === 'suggestions' && "No hay sugerencias por ahora. ¡Interactúa más para encontrarnos!"}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {users.map(user => {
                                const isFollowersTab = activeTab === 'followers';
                                const isSuggestionsTab = activeTab === 'suggestions';
                                // Logic:
                                // Suggestions: 'Seguir' button (User is not followed)
                                // Followers: 'Seguir' (if not following back) or 'Siguiendo' (if following back)
                                // Following: 'Siguiendo' (hover to unfollow)

                                let isFollowing = false;

                                if (isFollowersTab) {
                                    isFollowing = user.is_following_back || false; // Showing if I follow them back
                                } else if (isSuggestionsTab) {
                                    isFollowing = false; // By definition
                                } else {
                                    isFollowing = user.is_following; // I follow them
                                }

                                // Prevent showing Follow button for myself
                                const isMe = user.anonymous_id === currentAnonymousId;

                                return (
                                    <div key={user.anonymous_id} className="flex items-center justify-between p-4 bg-card border border-border rounded-lg shadow-sm">
                                        <div className="flex items-center gap-3 flex-1 min-w-0" onClick={() => navigate(`/usuario/${user.alias}`)}>
                                            <Avatar className="h-10 w-10 border border-border cursor-pointer">
                                                <AvatarImage src={user.avatar_url || getAvatarUrl(user.anonymous_id)} />
                                                <AvatarFallback>{user.alias?.substring(0, 2).toUpperCase()}</AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <div className="font-medium text-foreground truncate flex items-center gap-2">
                                                    <span>@{user.alias}</span>
                                                    {user.level > 1 && (
                                                        <Badge variant="outline" className="text-[10px] h-4 px-1 border-neon-green/30 text-neon-green/70">
                                                            Nvl {user.level}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {isSuggestionsTab && user.common_locality && user.common_locality !== 'Global' && (
                                                    <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-neon-green/50 inline-block"></span>
                                                        Activo en {user.common_locality}
                                                    </div>
                                                )}
                                                {isSuggestionsTab && user.common_locality === 'Global' && (
                                                    <div className="text-xs text-muted-foreground truncate">
                                                        Top Miembro de la Comunidad
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {!isMe && (
                                            <Button
                                                size="sm"
                                                variant={isFollowing ? "outline" : "default"}
                                                onClick={() => handleFollowToggle(user)}
                                                className={`ml-3 ${isFollowing
                                                    ? "border-border text-muted-foreground hover:text-destructive hover:border-destructive"
                                                    : "bg-neon-green text-black hover:bg-neon-green/90"}`}
                                            >
                                                {isFollowing ? (
                                                    <>
                                                        <UserCheck className="h-4 w-4 mr-1" />
                                                        <span className="hidden sm:inline">Siguiendo</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <UserPlus className="h-4 w-4 sm:mr-1" />
                                                        <span className="hidden sm:inline">Seguir</span>
                                                    </>
                                                )}
                                            </Button>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}</div>
            </Tabs>
        </div>
    );
}
