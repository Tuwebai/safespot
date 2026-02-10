/**
 * 🏛️ SAFE MODE: NextBadgeCard - Componente Visual Independiente
 * 
 * Fase 3 Polish: Card expandida y más prominente para mejor motivación.
 * 
 * @version 1.1 - Visual polish
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Target } from 'lucide-react';

export interface NextBadge {
    name: string;
    icon: string;
    progress: {
        current: number;
        required: number;
    };
}

export interface NextBadgeCardProps {
    /** Próximo logro a mostrar */
    badge: NextBadge;
}

export function NextBadgeCard({ badge }: NextBadgeCardProps) {
    const progressPercent = badge.progress.required 
        ? (badge.progress.current / badge.progress.required) * 100 
        : 0;

    return (
        <Card className="bg-gradient-to-br from-card to-muted/30 border-neon-green/20 relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon-green/5 rounded-full blur-3xl -mr-16 -mt-16" />
            
            <CardHeader className="pb-3 relative">
                <CardTitle className="flex items-center gap-2 text-sm uppercase tracking-wider text-neon-green font-bold">
                    <Target className="h-4 w-4" />
                    Próximo Logro
                </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-0 relative">
                <div className="flex items-center gap-4">
                    {/* Icono más grande y prominente */}
                    <div className="w-14 h-14 rounded-xl bg-neon-green/10 border border-neon-green/20 flex items-center justify-center shrink-0">
                        <span className="text-2xl">{badge.icon}</span>
                    </div>
                    
                    <div className="flex-1 min-w-0">
                        <h4 className="text-base font-bold truncate text-foreground">
                            {badge.name}
                        </h4>
                        
                        {/* Progress bar más grande */}
                        <div className="w-full bg-muted rounded-full h-2.5 mt-2">
                            <div 
                                className="bg-gradient-to-r from-neon-green to-emerald-400 h-full rounded-full transition-all duration-1000" 
                                style={{ width: `${progressPercent}%` }} 
                            />
                        </div>
                        
                        <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">
                                {badge.progress.current} / {badge.progress.required}
                            </p>
                            <span className="text-xs font-bold text-neon-green">
                                {Math.round(progressPercent)}%
                            </span>
                        </div>
                    </div>
                </div>
                
                {/* Motivational text */}
                <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border/50">
                    {progressPercent >= 75 
                        ? "¡Casi lo tienes! Un empujón más." 
                        : progressPercent >= 50 
                            ? "Vas por buen camino, sigue así."
                            : "Cada paso cuenta, ¡tú puedes!"}
                </p>
            </CardContent>
        </Card>
    );
}
