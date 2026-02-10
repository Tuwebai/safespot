/**
 * 🏛️ SAFE MODE: StatsCards - Componente Visual Independiente
 * 
 * Fase 1 del refactor enterprise: Extracción quirúrgica de estadísticas.
 * Solo movimiento de código, sin cambio de lógica.
 * 
 * @version 1.0 - Extracción únicamente
 */

export interface StatsCardsProps {
    /** Total de reportes */
    totalReports: number;
    /** Total de votos/apoyos */
    totalVotes: number;
    /** Total de comentarios */
    totalComments: number;
}

export function StatsCards({ totalReports, totalVotes, totalComments }: StatsCardsProps) {
    return (
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="text-center p-3 sm:p-4 rounded-lg bg-card border border-border min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-neon-green">{totalReports}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-tighter mt-1 truncate">
                    Reportes
                </div>
            </div>
            <div className="text-center p-3 sm:p-4 rounded-lg bg-card border border-border min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-neon-green">{totalVotes}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-tighter mt-1 truncate">
                    Apoyos
                </div>
            </div>
            <div className="text-center p-3 sm:p-4 rounded-lg bg-card border border-border min-w-0">
                <div className="text-xl sm:text-2xl font-bold text-neon-green">{totalComments}</div>
                <div className="text-[9px] sm:text-[10px] uppercase font-bold text-muted-foreground tracking-tighter mt-1 truncate">
                    Coment.
                </div>
            </div>
        </div>
    );
}
