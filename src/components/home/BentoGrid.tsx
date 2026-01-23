import React, { useState } from 'react';
import { Report } from '@/lib/api';
import { SafeSpotMapClient } from '@/components/map/SafeSpotMapClient';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/Avatar';
import { getAvatarUrl, getAvatarFallback } from '@/lib/avatar';
import { ShieldCheck, TrendingUp, MousePointer2, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BentoGridProps {
    heatmapReports: Report[];
}

export const BentoGrid: React.FC<BentoGridProps> = ({ heatmapReports }) => {
    const [isMapActive, setIsMapActive] = useState(false);

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 md:grid-rows-2 gap-4 md:gap-6 h-auto md:h-[600px]">

            {/* Tile A: Map - Spans 2 cols, 2 rows (Main Feature) */}
            <motion.div
                className="md:col-span-2 md:row-span-2 relative group overflow-hidden rounded-3xl border border-border bg-card h-[320px] md:h-auto transition-all duration-300"
                onMouseLeave={() => setIsMapActive(false)}
            >
                {/* Map Container - Toggle Pointer Events */}
                <div
                    className={cn(
                        "absolute inset-0 z-0 transition-opacity duration-500",
                        isMapActive ? "opacity-100 pointer-events-auto" : "opacity-60 group-hover:opacity-80 pointer-events-none"
                    )}
                >
                    <SafeSpotMapClient
                        reportIds={heatmapReports.map(r => r.id)}
                        initialFocus={null}
                        className="w-full h-full"
                        hideControls={!isMapActive}
                    />

                    {/* Exit Interaction Button (Mobile/Desktop friendly) */}
                    {isMapActive && (
                        <div className="absolute top-4 right-4 z-50">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsMapActive(false);
                                }}
                                className="bg-background/90 backdrop-blur shadow-md hover:bg-background border border-border h-8 px-3 text-xs gap-2"
                            >
                                <X className="w-3 h-3" />
                                Salir
                            </Button>
                        </div>
                    )}

                    {/* Overlay Gradient */}
                    <div className={cn(
                        "absolute inset-0 bg-gradient-to-t from-card/90 via-transparent to-transparent z-10 pointer-events-none transition-opacity duration-300",
                        isMapActive ? "opacity-0" : "opacity-100"
                    )} />
                </div>

                {/* Interaction Prompt Overlay */}
                {!isMapActive && (
                    <div
                        className="absolute inset-0 z-20 flex items-center justify-center cursor-pointer bg-black/5 hover:bg-black/10 transition-colors"
                        onClick={() => setIsMapActive(true)}
                    >
                        <Button
                            variant="secondary"
                            size="sm"
                            className="bg-background/80 backdrop-blur-md border border-border shadow-lg hover:bg-background gap-2 pointer-events-none"
                        >
                            <MousePointer2 className="w-4 h-4 text-primary" />
                            <span className="text-xs font-bold uppercase tracking-wider">Activar Mapa</span>
                        </Button>
                    </div>
                )}

                <div className={cn(
                    "absolute bottom-6 left-6 z-20 pointer-events-none transition-opacity duration-300",
                    isMapActive ? "opacity-0" : "opacity-100"
                )}>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-background/60 backdrop-blur-md border border-neon-green/30 mb-2">
                        <div className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                        <span className="text-[10px] font-bold text-neon-green uppercase">En Tiempo Real</span>
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-1">Visualización Táctica</h3>
                    <p className="text-muted-foreground text-sm max-w-sm">Monitoreo de zonas calientes e incidentes en tu radio de 5km.</p>
                </div>
            </motion.div>

            {/* Tile B: Gamification / Community (REAL DATA 24h & VERIFIED) */}
            <motion.div
                className="md:col-span-1 md:row-span-1 bg-card border border-border rounded-3xl p-6 flex flex-col justify-between hover:bg-accent/50 transition-colors h-[240px] md:h-auto"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
            >
                {(() => {
                    // Logic: Extract Verified Users from LAST 24 HOURS
                    const now = new Date();
                    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

                    const recentActivity = heatmapReports.filter(r => new Date(r.created_at) > oneDayAgo);

                    // Unique Authors & Verified Check
                    const activeVerifiedAuthors = Array.from(
                        new Map(
                            recentActivity
                                .map(r => r.author)
                                .filter(a => !!a)
                                .filter(a => (a as any).is_verified === true || (a as any).verified === true)
                                .map(u => [u.id, u])
                        ).values()
                    );

                    const verifiedCount = activeVerifiedAuthors.length;
                    const displayAuthors = activeVerifiedAuthors.slice(0, 5);
                    const hasActivity = verifiedCount > 0;

                    return (
                        <>
                            <div>
                                <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center mb-4 text-yellow-500">
                                    <ShieldCheck className="w-6 h-6" />
                                </div>
                                <h3 className="text-lg font-bold text-foreground">Vigilantes Activos</h3>
                                {hasActivity ? (
                                    <p className="text-muted-foreground text-xs mt-1">
                                        <span className="text-neon-green font-bold">{verifiedCount}</span> vecinos verificados reportaron en las últimas 24h.
                                    </p>
                                ) : (
                                    <p className="text-muted-foreground text-xs mt-1 leading-relaxed">
                                        Aún no hay actividad reciente.
                                    </p>
                                )}
                            </div>

                            {hasActivity ? (
                                <div className="flex -space-x-3 mt-4">
                                    {displayAuthors.map((user, i) => (
                                        <Avatar key={i} className="w-10 h-10 ring-2 ring-background">
                                            <AvatarImage src={user.avatarUrl || (user as any).avatar_url || getAvatarUrl(user.alias)} />
                                            <AvatarFallback>{getAvatarFallback(user.alias)}</AvatarFallback>
                                        </Avatar>
                                    ))}
                                    {verifiedCount > 5 && (
                                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs ring-2 ring-background font-bold text-foreground">
                                            +{verifiedCount - 5}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="mt-4">
                                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-2">
                                        Tu zona te necesita
                                    </p>
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center border border-border animate-pulse">
                                            <div className="w-3 h-3 bg-neon-green rounded-full shadow-[0_0_10px_#00ff9d]" />
                                        </div>
                                        <p className="text-sm text-foreground font-semibold leading-tight">
                                            Sé el primero en proteger tu comunidad
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    );
                })()}
            </motion.div>

            {/* Tile C: Recoveries (Stats - Real Data 7 Days) */}
            <motion.div
                className="md:col-span-1 md:row-span-1 bg-card border border-border rounded-3xl p-6 flex flex-col justify-between hover:bg-accent/50 transition-colors relative overflow-hidden h-[240px] md:h-auto"
                initial={{ opacity: 0, x: 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                viewport={{ once: true }}
            >
                {(() => {
                    // Logic: Calculate Resolved in Last 7 Days
                    const now = new Date();
                    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

                    // Filter reports that are 'resuelto' AND updated within the last 7 days (proxy for resolution date)
                    const resolvedThisWeek = heatmapReports.filter(r =>
                        r.status === 'resuelto' &&
                        new Date(r.updated_at) > sevenDaysAgo
                    ).length;

                    return (
                        <>
                            {/* Background Chart Effect (Decorational) */}
                            <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none">
                                <TrendingUp className="w-32 h-32 text-neon-green translate-x-10 translate-y-10" />
                            </div>

                            <div>
                                <h3 className="text-4xl font-mono font-bold text-foreground tracking-tighter">
                                    {resolvedThisWeek}
                                </h3>
                                <p className="text-neon-green text-xs font-bold uppercase mt-1">Objetos Recuperados</p>
                            </div>

                            <div className="z-10 relative mt-auto">
                                <p className="text-muted-foreground text-xs leading-relaxed">
                                    Impacto real esta semana.
                                </p>
                                <p className="text-[10px] text-muted-foreground/80 font-medium mt-1">
                                    Confirmados por la comunidad.
                                </p>
                            </div>
                        </>
                    )
                })()}
            </motion.div>
        </div>
    );
};
