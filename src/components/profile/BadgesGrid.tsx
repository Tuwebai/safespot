/**
 * 🏛️ SAFE MODE: BadgesGrid - Componente Visual Independiente
 * 
 * Fase 1 del refactor enterprise: Extracción quirúrgica del grid de insignias.
 * Solo movimiento de código, sin cambio de lógica.
 * 
 * @version 1.0 - Extracción únicamente
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Award, ChevronRight } from 'lucide-react';

export interface Badge {
    id: string;
    name: string;
    icon: string;
    points: number;
    obtained: boolean;
}

export interface BadgesGridProps {
    /** Lista de insignias obtenidas */
    badges: Badge[];
}

export function BadgesGrid({ badges }: BadgesGridProps) {
    const [showAll, setShowAll] = useState(false);
    const hasBadges = badges.length > 0;
    const displayBadges = showAll ? badges : badges.slice(0, 4);
    const hasMore = badges.length > 4;

    return (
        <Card className={`bg-card border-border transition-all duration-300 min-h-[140px] ${showAll ? 'row-span-2' : ''}`}>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                        <Award className="h-4 w-4" />
                        Insignias
                    </div>
                    {hasBadges && (
                        <span className="text-xs text-muted-foreground font-normal">{badges.length} obtenidas</span>
                    )}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                {!hasBadges ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                        Completa misiones para ganar insignias
                    </p>
                ) : (
                    <>
                        <div className={`grid grid-cols-4 gap-2 ${showAll ? 'max-h-64 overflow-y-auto pr-1' : ''}`}>
                            {displayBadges.map(badge => (
                                <div 
                                    key={badge.id} 
                                    className="aspect-square bg-neon-green/10 border border-neon-green/20 rounded-lg flex items-center justify-center relative group cursor-pointer hover:bg-neon-green/20 transition-colors" 
                                    title={`${badge.name} - ${badge.points} pts`}
                                >
                                    <span className="text-xl">{badge.icon}</span>
                                    <div className="absolute -bottom-1 -right-1 bg-neon-green text-[8px] text-black font-bold px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                                        {badge.points}
                                    </div>
                                </div>
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
                                    <>Ver todas ({badges.length}) <ChevronRight className="h-3 w-3 ml-1" /></>
                                )}
                            </Button>
                        )}
                    </>
                )}
            </CardContent>
        </Card>
    );
}
