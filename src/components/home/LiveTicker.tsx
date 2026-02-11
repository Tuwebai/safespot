import React from 'react';
import type { Report } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { AlertCircle, CheckCircle, Bike, Smartphone, Car, ShieldAlert } from 'lucide-react';
// Import marquee library or use CSS animation. Using CSS Tailwind arbitrary for now.

interface LiveTickerProps {
    reports: Report[];
}

const getIcon = (category: string) => {
    switch (category.toLowerCase()) {
        case 'robo': return <ShieldAlert className="w-4 h-4 text-red-500" />;
        case 'bicicletas': return <Bike className="w-4 h-4 text-neon-green" />;
        case 'celulares': return <Smartphone className="w-4 h-4 text-blue-400" />;
        case 'autos': return <Car className="w-4 h-4 text-orange-400" />;
        case 'recuperado': return <CheckCircle className="w-4 h-4 text-green-500" />;
        default: return <AlertCircle className="w-4 h-4 text-gray-400" />;
    }
}

export const LiveTicker: React.FC<LiveTickerProps> = ({ reports }) => {
    if (!reports || reports.length === 0) return null;

    return (
        <div className="w-full bg-background/80 border-y border-border backdrop-blur-sm relative z-20">
            {/* Center content container */}
            <div className="container mx-auto max-w-7xl flex items-center justify-center overflow-x-auto no-scrollbar py-3 gap-8">
                {reports.map((report, idx) => (
                    <div
                        key={`${report.id}-${idx}`}
                        className="flex items-center gap-2 text-sm text-muted-foreground shrink-0 select-none cursor-default px-2 py-1 rounded hover:bg-accent transition-colors whitespace-nowrap"
                    >
                        {getIcon(report.category)}
                        <span className="font-semibold text-foreground">{report.title}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="text-muted-foreground truncate max-w-[150px]">{report.zone || 'Ubicación desconocida'}</span>
                        <span className="text-muted-foreground/50">•</span>
                        <span className="text-neon-green text-xs">
                            {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: es })}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
