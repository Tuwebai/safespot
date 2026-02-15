import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, TrendingUp, TrendingDown, Minus, MapPin, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { SEO } from '@/components/SEO';
import { useWeeklyStatsQuery } from '@/hooks/queries/useWeeklyStatsQuery';

/**
 * Weekly Summary Page
 * 
 * Displayed when clicking a "Weekly Digest" notification.
 * Shows aggregates for a specific zone.
 * 
 * queryParams: ?zone=ZonaName
 */
export function WeeklySummaryPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const zoneName = searchParams.get('zone');
    
    const { data: stats, isLoading: loading } = useWeeklyStatsQuery(zoneName);

    if (!zoneName) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] p-4 text-center">
                <ShieldAlert className="w-16 h-16 text-muted-foreground mb-4" />
                <h1 className="text-2xl font-bold mb-2">Zona no especificada</h1>
                <p className="text-muted-foreground mb-6">No pudimos encontrar el resumen que buscas.</p>
                <Button onClick={() => navigate('/')} variant="outline">
                    Volver al Inicio
                </Button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-neon-green mb-4" />
                <p className="text-muted-foreground">Analizando actividad de la zona...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background pb-20">
            <SEO 
                title={`Resumen Semanal: ${zoneName}`}
                description={`Actividad reportada en ${zoneName} esta semana.`}
            />

            {/* Header / Nav */}
            <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border p-4 flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-lg font-bold leading-tight">Resumen Semanal</h1>
                    <p className="text-xs text-muted-foreground">{stats?.period}</p>
                </div>
            </div>

            <main className="container max-w-md mx-auto p-4 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Zone Header */}
                <div className="text-center py-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neon-green/10 mb-4 ring-1 ring-neon-green/30">
                        <MapPin className="w-8 h-8 text-neon-green" />
                    </div>
                    <h2 className="text-2xl font-bold mb-1">{zoneName}</h2>
                    <p className="text-muted-foreground">Tu comunidad en números</p>
                </div>

                {/* Main Stats Card */}
                <Card className="border-neon-green/20 bg-neon-green/5 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <CheckCircle2 className="w-32 h-32" />
                    </div>
                    <CardHeader className="relative">
                        <CardDescription>Reportes totales</CardDescription>
                        <CardTitle className="text-4xl font-extrabold text-neon-green">
                            {stats?.totalReceived}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="relative">
                        <div className="flex items-center gap-2">
                             {stats?.diffPercent && stats?.diffPercent > 0 ? (
                                <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
                                    <TrendingUp className="w-3 h-3 mr-1" />
                                    +{stats.diffPercent}% vs semana anterior
                                </Badge>
                             ) : stats?.diffPercent && stats?.diffPercent < 0 ? (
                                <Badge variant="secondary" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20">
                                    <TrendingDown className="w-3 h-3 mr-1" />
                                    {stats.diffPercent}% vs semana anterior
                                </Badge>
                             ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                    <Minus className="w-3 h-3 mr-1" />
                                    Actividad estable
                                </Badge>
                             )}
                        </div>
                    </CardContent>
                </Card>

                {/* Category Breakdown */}
                <div className="grid grid-cols-1 gap-4">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base font-medium">Categoría Principal</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <span className="text-xl font-bold">{stats?.topCategory}</span>
                                <Badge variant="secondary">Más frecuente</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground mt-2">
                                40% de los reportes fueron de este tipo.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* CTA Map */}
                <Card className="overflow-hidden border-border cursor-pointer hover:border-neon-green/50 transition-colors group" onClick={() => navigate('/explorar')}>
                    <div className="h-32 bg-muted relative">
                        {/* Placeholder Map Pattern */}
                         <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#22c55e_1px,transparent_1px)] [background-size:16px_16px]" />
                         <div className="absolute inset-0 flex items-center justify-center">
                            <Button size="sm" className="group-hover:scale-105 transition-transform">
                                Ver Mapa de Calor
                            </Button>
                         </div>
                    </div>
                    <CardContent className="p-4">
                        <p className="text-sm font-medium">
                            Visualiza los puntos calientes de {zoneName} para tomar precauciones.
                        </p>
                    </CardContent>
                </Card>

                <div className="text-center pt-8">
                     <p className="text-xs text-muted-foreground mb-4">
                        Este resumen se genera automáticamente basado en reportes de la comunidad.
                     </p>
                     <Button variant="ghost" size="sm" className="text-muted-foreground">
                        Ajustar mis notificaciones
                     </Button>
                </div>

            </main>
        </div>
    );
}
