/**
 * 🏛️ SAFE MODE: CommunityHeader - Métricas y Contexto
 * 
 * Header enterprise con:
 * - Métricas dinámicas (total usuarios)
 * - Contexto de ubicación
 * - Refresh con timestamp
 * 
 * @version 1.0 - Enterprise
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, MapPin, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface CommunityHeaderProps {
    totalUsers: number;
    userLocality: string | null;
    activeTab: 'nearby' | 'global';
    onRefresh: () => void;
    isRefreshing: boolean;
    lastUpdated: Date | null;
}

export function CommunityHeader({
    totalUsers,
    userLocality,
    activeTab,
    onRefresh,
    isRefreshing,
    lastUpdated
}: CommunityHeaderProps) {
    const navigate = useNavigate();

    return (
        <div className="space-y-4 mb-6">
            {/* Header principal */}
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate(-1)}
                    className="shrink-0 hover:bg-white/5"
                >
                    <ArrowLeft className="w-6 h-6 text-foreground/80" />
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-neon-green to-emerald-400">
                        Comunidad
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        Conectate con personas que usan SafeSpot como vos
                    </p>
                </div>
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="shrink-0 hover:bg-white/5"
                    title="Actualizar lista"
                >
                    <RefreshCw className={cn("w-5 h-5 text-foreground/60", isRefreshing && "animate-spin")} />
                </Button>
            </div>

            {/* Métricas y contexto */}
            <div className="flex flex-wrap items-center gap-3 pl-14">
                {/* Total usuarios */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
                    <Users className="w-4 h-4 text-neon-green" />
                    <span className="text-sm">
                        <span className="font-semibold text-foreground">{totalUsers}</span>
                        <span className="text-muted-foreground ml-1">
                            {activeTab === 'nearby' ? 'en tu zona' : 'globales'}
                        </span>
                    </span>
                </div>

                {/* Ubicación (solo nearby) */}
                {activeTab === 'nearby' && userLocality && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border">
                        <MapPin className="w-4 h-4 text-blue-400" />
                        <span className="text-sm text-muted-foreground">
                            {userLocality}
                        </span>
                    </div>
                )}

                {/* Last updated */}
                {lastUpdated && (
                    <div className="text-xs text-muted-foreground/60">
                        Actualizado {formatDistanceToNow(lastUpdated, { addSuffix: true, locale: es })}
                    </div>
                )}
            </div>
        </div>
    );
}

// Helper para cn (importado localmente para evitar dependencias circulares)
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
