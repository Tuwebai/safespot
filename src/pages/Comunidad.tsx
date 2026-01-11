import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { usersApi } from '@/lib/api';
import { CommunityTabs } from '@/components/comunidad/CommunityTabs';
import { UserCard } from '@/components/comunidad/UserCard';
import { EmptyCommunityState } from '@/components/comunidad/EmptyCommunityState';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Comunidad() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'nearby' | 'global'>('nearby');

    // Fetch Nearby Users
    const {
        data: nearbyUsers,
        isLoading: isLoadingNearby,
        error: errorNearby
    } = useQuery({
        queryKey: ['users', 'nearby'],
        queryFn: usersApi.getNearbyUsers,
        enabled: activeTab === 'nearby',
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    // Fetch Global Users
    const {
        data: globalUsers,
        isLoading: isLoadingGlobal,
        error: errorGlobal
    } = useQuery({
        queryKey: ['users', 'global'],
        queryFn: () => usersApi.getGlobalUsers(1),
        enabled: activeTab === 'global',
        staleTime: 1000 * 60 * 5, // 5 minutes cache
    });

    const isLoading = activeTab === 'nearby' ? isLoadingNearby : isLoadingGlobal;
    const error = activeTab === 'nearby' ? errorNearby : errorGlobal;
    const users = activeTab === 'nearby' ? nearbyUsers : globalUsers;
    const isEmpty = !isLoading && (!users || users.length === 0);

    return (
        <div className="min-h-screen pb-20 md:pb-8 pt-4 md:pt-8 bg-background">
            <div className="container max-w-2xl mx-auto px-4">

                {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(-1)}
                        className="shrink-0 hover:bg-white/5"
                    >
                        <ArrowLeft className="w-6 h-6 text-foreground/80" />
                    </Button>
                    <div>
                        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neon-green to-emerald-400">
                            Comunidad
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Conectate con personas que usan SafeSpot como vos
                        </p>
                    </div>
                </div>

                {/* Tabs */}
                <CommunityTabs activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Content */}
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                        <p className="text-sm text-muted-foreground animate-pulse">Buscando usuarios...</p>
                    </div>
                ) : error ? (
                    <div className="text-center py-12">
                        <p className="text-destructive mb-2">No pudimos cargar la comunidad.</p>
                        <button onClick={() => window.location.reload()} className="text-sm underline text-muted-foreground hover:text-primary">
                            Intentar de nuevo
                        </button>
                    </div>
                ) : isEmpty ? (
                    <EmptyCommunityState type={activeTab} />
                ) : (
                    <div className="grid gap-4">
                        {users?.map((user) => (
                            <UserCard key={user.anonymous_id} user={user} />
                        ))}

                        {/* Simple infinite scroll placeholder or "end of list" */}
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            {activeTab === 'global' ? 'Mostrando usuarios recientes' : 'Estos son todos los usuarios cerca de tu zona'}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}

// Default export for lazy loading
export default Comunidad; 
