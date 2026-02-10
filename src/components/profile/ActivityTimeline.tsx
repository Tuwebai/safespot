/**
 * 🏛️ SAFE MODE: ActivityTimeline - Componente Visual Independiente
 * 
 * Fase 1 del refactor enterprise: Extracción quirúrgica de "Actividad Reciente".
 * Solo movimiento de código, sin cambio de lógica.
 * 
 * @version 1.0 - Extracción únicamente
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity } from 'lucide-react';

interface Report {
    id: string;
    title: string;
}

interface Badge {
    id: string;
    name: string;
}

export interface ActivityTimelineProps {
    /** Reportes recientes (para mostrar actividad) */
    recentReports: Report[];
    /** Insignias obtenidas recientemente */
    recentBadges: Badge[];
}

export function ActivityTimeline({ recentReports, recentBadges }: ActivityTimelineProps) {
    const hasActivity = recentReports.length > 0 || recentBadges.length > 0;

    return (
        <Card className="bg-card border-border min-h-[120px]">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Actividad Reciente
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="space-y-3">
                    {recentReports.length > 0 && (
                        <>
                            <div className="flex items-start gap-3">
                                <div className="w-2 h-2 rounded-full bg-neon-green mt-1.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-xs">Creaste un reporte</p>
                                    <p className="text-[10px] text-muted-foreground">{recentReports[0]?.title}</p>
                                </div>
                            </div>
                            {recentReports[1] && (
                                <div className="flex items-start gap-3">
                                    <div className="w-2 h-2 rounded-full bg-muted-foreground/30 mt-1.5 shrink-0" />
                                    <div className="flex-1">
                                        <p className="text-xs">Creaste un reporte</p>
                                        <p className="text-[10px] text-muted-foreground">{recentReports[1]?.title}</p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    
                    {recentBadges.length > 0 && (
                        <div className="flex items-start gap-3">
                            <div className="w-2 h-2 rounded-full bg-yellow-500 mt-1.5 shrink-0" />
                            <div className="flex-1">
                                <p className="text-xs">Ganaste insignia</p>
                                <p className="text-[10px] text-muted-foreground">
                                    {recentBadges[recentBadges.length - 1]?.name}
                                </p>
                            </div>
                        </div>
                    )}
                    
                    {!hasActivity && (
                        <p className="text-xs text-muted-foreground text-center py-2">
                            Sin actividad reciente
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
