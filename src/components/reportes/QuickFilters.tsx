import { Button } from '@/components/ui/button'
import { Flame, AlertTriangle, Construction, Star, List } from 'lucide-react'

export type QuickFilterType = 'urgent' | 'robos' | 'infraestructura' | 'mi_zona' | 'all'

interface QuickFiltersProps {
    activeFilter: QuickFilterType
    onFilterChange: (filter: QuickFilterType) => void
}

const FILTERS = [
    { id: 'urgent' as const, label: 'Urgentes', icon: Flame, color: 'text-red-400' },
    { id: 'robos' as const, label: 'Robos', icon: AlertTriangle, color: 'text-orange-400' },
    { id: 'infraestructura' as const, label: 'Infraestructura', icon: Construction, color: 'text-yellow-400' },
    { id: 'mi_zona' as const, label: 'Mi Zona', icon: Star, color: 'text-neon-green' },
    { id: 'all' as const, label: 'Todos', icon: List, color: 'text-muted-foreground' },
]

/**
 * Filtros Rápidos - 1-tap, sin acordeón
 * Chips visibles para exploración inmediata
 */
export function QuickFilters({ activeFilter, onFilterChange }: QuickFiltersProps) {
    return (
        <div className="mb-6">
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {FILTERS.map((filter) => {
                    const Icon = filter.icon
                    const isActive = activeFilter === filter.id

                    return (
                        <Button
                            key={filter.id}
                            variant={isActive ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => onFilterChange(filter.id)}
                            className={`
                flex items-center gap-2 whitespace-nowrap transition-all duration-200
                ${isActive
                                    ? 'bg-neon-green text-dark-bg hover:bg-neon-green/90 shadow-[0_0_15px_rgba(33,255,140,0.3)]'
                                    : 'hover:bg-card/50 hover:border-neon-green/30'
                                }
              `}
                        >
                            <Icon className={`h-4 w-4 ${isActive ? 'text-dark-bg' : filter.color}`} />
                            <span className="font-medium">{filter.label}</span>
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}
