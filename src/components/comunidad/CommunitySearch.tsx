/**
 * 🏛️ SAFE MODE: CommunitySearch - Filtro Local Client-Side
 * 
 * Búsqueda local de usuarios sin llamadas API adicionales.
 * Filtra por alias en tiempo real.
 * 
 * @version 1.0 - Client-side filtering
 */

import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CommunitySearchProps {
    value: string;
    onChange: (value: string) => void;
    resultsCount?: number;
    totalCount?: number;
    placeholder?: string;
}

export function CommunitySearch({
    value,
    onChange,
    resultsCount,
    totalCount,
    placeholder = "Buscar por alias..."
}: CommunitySearchProps) {
    const hasSearch = value.length > 0;
    const showResults = hasSearch && resultsCount !== undefined && totalCount !== undefined;

    return (
        <div className="space-y-2">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className={cn(
                        "pl-10 pr-10 bg-card border-border",
                        "focus:border-neon-green/50 focus:ring-neon-green/20",
                        "placeholder:text-muted-foreground/50"
                    )}
                />
                {hasSearch && (
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onChange('')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                    >
                        <X className="w-4 h-4" />
                    </Button>
                )}
            </div>

            {/* Results indicator */}
            {showResults && (
                <div className="flex items-center justify-between text-xs">
                    <span className={cn(
                        "text-muted-foreground",
                        resultsCount === 0 && "text-destructive"
                    )}>
                        {resultsCount === 0 
                            ? "No se encontraron resultados" 
                            : `Mostrando ${resultsCount} de ${totalCount}`
                        }
                    </span>
                    {resultsCount === 0 && (
                        <Button
                            variant="link"
                            size="sm"
                            onClick={() => onChange('')}
                            className="h-auto p-0 text-neon-green text-xs"
                        >
                            Limpiar búsqueda
                        </Button>
                    )}
                </div>
            )}
        </div>
    );
}
