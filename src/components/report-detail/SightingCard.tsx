import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Eye, MapPin, AlertTriangle, Clock } from 'lucide-react';

export interface SightingData {
    id: string;
    subtype: 'seen' | 'likely' | 'possible';
    data: {
        zone: string;
        text: string;
    };
    created_at: string;
}

const CONFIG = {
    seen: {
        label: 'Avistamiento',
        icon: Eye,
        color: 'text-neon-green',
        bg: 'bg-neon-green/10',
        border: 'border-neon-green/30'
    },
    likely: {
        label: 'Zona Sugerida',
        icon: MapPin,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        border: 'border-blue-500/30'
    },
    possible: {
        label: 'Posible Pista',
        icon: AlertTriangle,
        color: 'text-yellow-500',
        bg: 'bg-yellow-500/10',
        border: 'border-yellow-500/30'
    }
};

export function SightingCard({ sighting }: { sighting: SightingData }) {
    const config = CONFIG[sighting.subtype] || CONFIG.possible;
    const Icon = config.icon;

    return (
        <div className={`mb-3 p-4 rounded-xl border ${config.border} ${config.bg} animate-in fade-in slide-in-from-top-2`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${config.color}`} />
                    <span className={`text-xs font-bold uppercase tracking-wider ${config.color}`}>
                        {config.label}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                        Hace {formatDistanceToNow(new Date(sighting.created_at), { locale: es })}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="space-y-1">
                <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <span className="font-medium text-foreground">{sighting.data.zone}</span>
                </div>
                {sighting.data.text && (
                    <p className="text-sm text-muted-foreground pl-6 border-l-2 border-border py-1">
                        "{sighting.data.text}"
                    </p>
                )}
            </div>
        </div>
    );
}
