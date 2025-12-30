import { Button } from '@/components/ui/button';
import { Eye, MapPin, AlertTriangle } from 'lucide-react';

export type SightingType = 'seen' | 'likely' | 'possible';

interface SightingActionsProps {
    onActionClick: (type: SightingType) => void;
    disabled?: boolean;
}

export function SightingActions({ onActionClick, disabled }: SightingActionsProps) {
    return (
        <div className="mb-6 p-4 bg-dark-card border border-dark-border rounded-xl">
            <div className="text-center mb-4">
                <h3 className="text-sm font-medium text-foreground">¿Viste este objeto?</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Si viste algo o tenés una pista, marcala acá. Incluso una pequeña info puede ayudar.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1 border-neon-green/30 hover:bg-neon-green/10 hover:border-neon-green/60 transition-all group"
                    onClick={() => onActionClick('seen')}
                    disabled={disabled}
                >
                    <Eye className="h-5 w-5 text-neon-green group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-neon-green">Lo vi</span>
                </Button>

                <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1 border-blue-500/30 hover:bg-blue-500/10 hover:border-blue-500/60 transition-all group"
                    onClick={() => onActionClick('likely')}
                    disabled={disabled}
                >
                    <MapPin className="h-5 w-5 text-blue-500 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-blue-500 text-xs sm:text-sm">Creo verlo visto</span>
                </Button>

                <Button
                    variant="outline"
                    className="h-auto py-3 flex flex-col items-center gap-1 border-yellow-500/30 hover:bg-yellow-500/10 hover:border-yellow-500/60 transition-all group"
                    onClick={() => onActionClick('possible')}
                    disabled={disabled}
                >
                    <AlertTriangle className="h-5 w-5 text-yellow-500 group-hover:scale-110 transition-transform" />
                    <span className="font-semibold text-yellow-500 text-xs sm:text-sm">Posible pista</span>
                </Button>
            </div>
        </div>
    );
}
