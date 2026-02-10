/**
 * 🏛️ SAFE MODE: Comunidad - Página Rediseñada Enterprise
 * 
 * Integración completa con:
 * - Header con métricas
 * - Búsqueda local
 * - Grid responsive
 * - Error boundary
 * - Empty states enterprise
 * 
 * @version 2.0 - Enterprise Redesign
 */

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { usersApi, UserProfile } from '@/lib/api';
import { CommunityErrorBoundary } from '@/components/comunidad/CommunityErrorBoundary';
import { CommunityHeader } from '@/components/comunidad/CommunityHeader';
import { CommunityTabs } from '@/components/comunidad/CommunityTabs';
import { CommunitySearch } from '@/components/comunidad/CommunitySearch';
import { UserGrid } from '@/components/comunidad/UserGrid';
import { EmptyCommunityState } from '@/components/comunidad/EmptyCommunityState';
import { queryClient } from '@/lib/queryClient';

export function Comunidad() {
    const [activeTab, setActiveTab] = useState<'nearby' | 'global'>('nearby');
    const [searchQuery, setSearchQuery] = useState('');
    const [userLocality, setUserLocality] = useState<string | null>(null);
    const [hasNoLocation, setHasNoLocation] = useState(false);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

    // ✅ ENTERPRISE: Robust Data Normalization
    const normalizeUsers = (data: unknown): UserProfile[] => {
        if (!data) return [];
        if (Array.isArray(data)) return data;
        if (data && typeof data === 'object') {
            const d = data as Record<string, unknown>;
            if (Array.isArray(d.data)) return d.data as UserProfile[];
            if (Array.isArray(d.users)) return d.users as UserProfile[];
        }
        return [];
    };

    // Fetch Nearby Users
    const {
        data: nearbyUsers,
        isLoading: isLoadingNearby,
        error: errorNearby,
        isFetching: isFetchingNearby
    } = useQuery({
        queryKey: ['users', 'nearby'],
        queryFn: async () => {
            const response = await usersApi.getNearbyUsers();
            const meta = (response as { meta?: { locality?: string; has_location_configured?: boolean } }).meta || {};
            
            if (typeof meta.has_location_configured === 'boolean') {
                setHasNoLocation(!meta.has_location_configured);
            } else if (meta.locality !== undefined) {
                setHasNoLocation(!meta.locality);
            }
            if (meta.locality) {
                setUserLocality(meta.locality);
            }
            setLastUpdated(new Date());
            return response;
        },
        select: (data) => normalizeUsers(data),
        enabled: activeTab === 'nearby',
        staleTime: 1000 * 10,
        refetchInterval: 1000 * 30,
    });

    // Fetch Global Users - Cargar suficientes para búsqueda client-side fluida
    const {
        data: globalUsers,
        isLoading: isLoadingGlobal,
        error: errorGlobal,
        isFetching: isFetchingGlobal
    } = useQuery({
        queryKey: ['users', 'global'],
        queryFn: async () => {
            setLastUpdated(new Date());
            // 🎯 Cargar más usuarios (hasta 200) para búsqueda client-side fluida
            // Esto permite búsqueda inmediata sin perder focus del input
            const response = await usersApi.getGlobalUsers(1, 200);
            return response;
        },
        select: (data) => normalizeUsers(data),
        enabled: activeTab === 'global',
        staleTime: 1000 * 60 * 5,
    });

    // Estados consolidados
    const isLoading = activeTab === 'nearby' ? isLoadingNearby : isLoadingGlobal;
    const isRefreshing = activeTab === 'nearby' ? isFetchingNearby : isFetchingGlobal;
    const error = activeTab === 'nearby' ? errorNearby : errorGlobal;
    const rawUsers = (activeTab === 'nearby' ? nearbyUsers : globalUsers) || [];

    // ✅ Búsqueda fluida client-side (como estaba originalmente)
    // Filtra sobre los usuarios cargados en memoria sin re-render que pierda focus
    const filteredUsers = useMemo(() => {
        if (!searchQuery.trim()) return rawUsers;
        const query = searchQuery.toLowerCase().trim();
        return rawUsers.filter(user => 
            user.alias?.toLowerCase().includes(query) ||
            user.anonymous_id?.toLowerCase().includes(query) ||
            user.display_alias?.toLowerCase().includes(query)
        );
    }, [rawUsers, searchQuery]);

    // Handlers
    const handleRefresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: ['users', activeTab] });
    }, [activeTab]);

    const handleClearSearch = useCallback(() => {
        setSearchQuery('');
    }, []);

    // Empty state determination
    const getEmptyStateVariant = useCallback((): 'location_missing' | 'nearby_empty' | 'global_empty' | 'search_empty' => {
        if (searchQuery.trim() && filteredUsers.length === 0) {
            return 'search_empty';
        }
        if (activeTab === 'nearby' && hasNoLocation) {
            return 'location_missing';
        }
        if (activeTab === 'nearby') {
            return 'nearby_empty';
        }
        return 'global_empty';
    }, [activeTab, hasNoLocation, searchQuery, filteredUsers.length]);

    // Render empty state
    const renderEmptyState = () => {
        const variant = getEmptyStateVariant();
        return (
            <EmptyCommunityState
                variant={variant}
                locality={userLocality}
                query={searchQuery}
                onClearSearch={handleClearSearch}
            />
        );
    };

    return (
        <CommunityErrorBoundary onReset={handleRefresh}>
            <div className="min-h-screen pb-20 md:pb-8 pt-4 md:pt-8 bg-background">
                <div className="container max-w-4xl mx-auto px-4">
                    
                    {/* Header Enterprise con métricas */}
                    <CommunityHeader
                        totalUsers={filteredUsers.length}
                        userLocality={userLocality}
                        activeTab={activeTab}
                        onRefresh={handleRefresh}
                        isRefreshing={isRefreshing}
                        lastUpdated={lastUpdated}
                    />

                    {/* Tabs */}
                    <CommunityTabs activeTab={activeTab} onTabChange={setActiveTab} />

                    {/* Search (solo cuando hay datos o cuando no es loading/error) */}
                    {(rawUsers.length > 0 || searchQuery) && !isLoading && !error && (
                        <div className="mb-4">
                            <CommunitySearch
                                value={searchQuery}
                                onChange={setSearchQuery}
                                resultsCount={filteredUsers.length}
                                totalCount={rawUsers.length}
                                placeholder={`Buscar ${activeTab === 'nearby' ? 'cerca' : 'global'}...`}
                            />
                        </div>
                    )}

                    {/* Error state */}
                    {error && (
                        <div className="text-center py-12">
                            <p className="text-destructive mb-2">No pudimos cargar la comunidad.</p>
                            <button 
                                onClick={handleRefresh} 
                                className="text-sm underline text-muted-foreground hover:text-primary"
                            >
                                Intentar de nuevo
                            </button>
                        </div>
                    )}

                    {/* User Grid */}
                    {!error && (
                        <UserGrid
                            users={filteredUsers}
                            loading={isLoading}
                            emptyState={!isLoading && filteredUsers.length === 0 ? renderEmptyState() : undefined}
                            showLocation={activeTab === 'nearby'}
                        />
                    )}

                    {/* Footer info */}
                    {!isLoading && !error && filteredUsers.length > 0 && (
                        <div className="text-center py-8 text-xs text-muted-foreground">
                            {activeTab === 'global' 
                                ? 'Mostrando usuarios recientes' 
                                : searchQuery 
                                    ? `Resultados de búsqueda en ${userLocality || 'tu zona'}`
                                    : 'Estos son todos los usuarios cerca de tu zona'
                            }
                        </div>
                    )}
                </div>
            </div>
        </CommunityErrorBoundary>
    );
}

// Default export for lazy loading
export default Comunidad;
