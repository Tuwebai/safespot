import React, { useState } from 'react';
import { useReportDetailQuery } from '../../hooks/queries/useReportsQuery';
import { MiniMapPreview } from '../location/MiniMapPreview';
import { Badge } from '../ui/badge';
import { ChevronDown, ChevronUp, MapPin, Calendar, Info } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

interface ChatReportContextProps {
    reportId: string;
}

export const ChatReportContext: React.FC<ChatReportContextProps> = ({ reportId }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    const { data: report, isLoading } = useReportDetailQuery(reportId);

    if (!reportId || isLoading || !report) return null;

    return (
        <div className="border-b border-white/5 bg-white/[0.02]">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                        <Info className="w-4 h-4 text-primary" />
                    </div>
                    <div className="text-left">
                        <p className="text-[10px] text-white/40 uppercase font-bold">Contexto del Reporte</p>
                        <h4 className="text-xs text-white/90 font-medium truncate">{report.title}</h4>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className="hidden sm:flex text-[10px] bg-primary/5 border-primary/20 text-primary">
                        {report.category}
                    </Badge>
                    {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-white/30" />
                    ) : (
                        <ChevronDown className="w-4 h-4 text-white/30" />
                    )}
                </div>
            </button>

            {isExpanded && (
                <div className="px-4 pb-4 pt-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-3">
                            <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                                <p className="text-[11px] text-white/80 leading-relaxed">
                                    {report.description}
                                </p>
                            </div>

                            <div className="flex flex-wrap gap-4 text-[11px] text-white/50">
                                <div className="flex items-center gap-1.5">
                                    <MapPin className="w-3.5 h-3.5 text-primary/70" />
                                    <span>{report.address}</span>
                                </div>
                                {report.incident_date && (
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-primary/70" />
                                        <span>{format(new Date(report.incident_date), "d 'de' MMMM, yyyy", { locale: es })}</span>
                                    </div>
                                )}
                                <div className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[9px] font-bold">
                                    {report.status}
                                </div>
                            </div>
                        </div>

                        <div className="h-[180px] rounded-xl overflow-hidden border border-white/10">
                            <MiniMapPreview
                                lat={report.latitude ? Number(report.latitude) : undefined}
                                lng={report.longitude ? Number(report.longitude) : undefined}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
