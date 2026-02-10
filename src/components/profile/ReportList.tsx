/**
 * 🏛️ SAFE MODE: ReportList - Componente Visual Independiente
 * 
 * Fase 1 del refactor enterprise: Extracción quirúrgica de la lista de reportes.
 * Solo movimiento de código, sin cambio de lógica.
 * 
 * @version 1.0 - Extracción únicamente
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, MapPin, Calendar, ThumbsUp, ChevronRight, Plus } from 'lucide-react';
import { PrefetchLink } from '@/components/PrefetchLink';

interface Report {
    id: string;
    title: string;
    status: string;
    upvotes_count: number;
    created_at: string;
}

export interface ReportListProps {
    /** Lista de reportes del usuario */
    reports: Report[];
    /** Callback para crear nuevo reporte */
    onCreateReport: () => void;
}

export function ReportList({ reports, onCreateReport }: ReportListProps) {
    const [showAll, setShowAll] = useState(false);
    const hasReports = reports.length > 0;
    const displayReports = showAll ? reports : reports.slice(0, 3);
    const hasMore = reports.length > 3;

    return (
        <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                    <FileText className="h-4 w-4" />
                    Mis Reportes
                    {hasReports && <Badge variant="secondary" className="text-xs">{reports.length}</Badge>}
                </CardTitle>
                {hasReports && (
                    <Button onClick={onCreateReport} variant="neon" size="sm" className="h-8">
                        <Plus className="w-4 h-4 mr-1" />
                        Crear
                    </Button>
                )}
            </CardHeader>
            <CardContent className="pt-0">
                {!hasReports ? (
                    // Empty State
                    <div className="flex flex-col sm:flex-row items-center sm:items-center gap-3 py-4 px-2 text-center sm:text-left">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 shrink-0 rounded-full bg-muted/50 flex items-center justify-center">
                            <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground/40" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm">Tu voz importa</h3>
                            <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-1">
                                Contanos qué pasó en tu zona. Tu primer reporte ayuda a todos.
                            </p>
                        </div>
                        <Button 
                            onClick={onCreateReport} 
                            variant="neon" 
                            size="sm" 
                            className="w-full sm:w-auto mt-2 sm:mt-0"
                        >
                            Crear
                        </Button>
                    </div>
                ) : (
                    // Report List
                    <>
                        <div className={`space-y-2 ${showAll ? 'max-h-80 overflow-y-auto pr-1' : ''}`}>
                            {displayReports.map((report) => (
                                <PrefetchLink 
                                    key={report.id} 
                                    to={`/reporte/${report.id}`} 
                                    prefetchRoute="DetalleReporte" 
                                    prefetchReportId={report.id}
                                >
                                    <div className="p-3 rounded-lg bg-muted/30 border border-border hover:border-neon-green/50 hover:bg-muted/50 transition-all group cursor-pointer">
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-medium text-sm line-clamp-1 group-hover:text-neon-green transition-colors">
                                                    {report.title}
                                                </h3>
                                                <div className="flex items-center gap-3 mt-1.5">
                                                    <Badge variant="outline" className="text-[10px] h-4 px-1">
                                                        {report.status}
                                                    </Badge>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <Calendar className="h-3 w-3" />
                                                        {new Date(report.created_at).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                                        <ThumbsUp className="h-3 w-3" />
                                                        {report.upvotes_count}
                                                    </span>
                                                </div>
                                            </div>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-neon-green transition-colors shrink-0 mt-0.5" />
                                        </div>
                                    </div>
                                </PrefetchLink>
                            ))}
                        </div>
                        
                        {hasMore && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                className="w-full mt-3 text-xs text-muted-foreground hover:text-neon-green"
                                onClick={() => setShowAll(!showAll)}
                            >
                                {showAll ? (
                                    <>Ver menos <ChevronRight className="h-3 w-3 ml-1 rotate-180" /></>
                                ) : (
                                    <>Ver más ({reports.length - 3}) <ChevronRight className="h-3 w-3 ml-1" /></>
                                )}
                            </Button>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
