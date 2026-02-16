import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { 
  Search, 
  MapPin, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  RotateCcw, 
  X, 
  Users,
  Flame,
  AlertTriangle,
  Bike,
  Star,
  List
} from 'lucide-react'
import { UserZoneCard } from './UserZoneCard'
import type { QuickFilterType } from './QuickFilters'
import { ALL_CATEGORIES as categories, STATUS_OPTIONS as statusOptions } from '@/lib/constants'
import type { AddressSuggestion } from '@/services/georefClient'

interface ReportsSidebarProps {
  // Filter States
  searchTerm: string
  setSearchTerm: (val: string) => void
  selectedCategory: string
  setSelectedCategory: (val: string) => void
  selectedStatus: string
  setSelectedStatus: (val: string) => void
  sortBy: 'recent' | 'popular' | 'oldest'
  setSortBy: (val: 'recent' | 'popular' | 'oldest') => void
  followedOnly: boolean
  setFollowedOnly: (val: boolean) => void
  favoritesOnly: boolean
  setFavoritesOnly: (val: boolean) => void
  
  // Advanced Filter States
  startDate: string
  setStartDate: (val: string) => void
  endDate: string
  setEndDate: (val: string) => void
  
  // Quick Filters
  quickFilter: QuickFilterType
  setQuickFilter: (val: QuickFilterType) => void
  
  // Address / Location
  addressQuery: string
  setAddressQuery: (val: string) => void
  selectedLocation: { lat: number, lng: number, label: string } | null
  setSelectedLocation: (val: { lat: number, lng: number, label: string } | null) => void
  addressSuggestions: AddressSuggestion[]
  setAddressSuggestions: (val: AddressSuggestion[]) => void
  
  // Context
  cityName: string | null
  
  // References
  searchInputRef: React.RefObject<HTMLInputElement>
  
  // Layout Controls
  isCollapsed?: boolean
  setIsCollapsed?: (val: boolean) => void
}

const QUICK_FILTERS = [
  { id: 'urgent' as const, label: 'Urgentes', icon: Flame, color: 'text-red-400' },
  { id: 'robos' as const, label: 'Robos', icon: AlertTriangle, color: 'text-orange-400' },
  { id: 'motos' as const, label: 'Motos', icon: Bike, color: 'text-yellow-400' },
  { id: 'mi_zona' as const, label: 'En mi zona', icon: MapPin, color: 'text-neon-green' },
  { id: 'all' as const, label: 'Todos', icon: List, color: 'text-muted-foreground' },
]

export function ReportsSidebar({
  searchTerm,
  setSearchTerm,
  selectedCategory,
  setSelectedCategory,
  selectedStatus,
  setSelectedStatus,
  sortBy,
  setSortBy,
  followedOnly,
  setFollowedOnly,
  favoritesOnly,
  setFavoritesOnly,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  quickFilter,
  setQuickFilter,
  addressQuery,
  setAddressQuery,
  selectedLocation,
  setSelectedLocation,
  addressSuggestions,
  setAddressSuggestions,
  cityName,
  searchInputRef,
  isCollapsed,
  setIsCollapsed
}: ReportsSidebarProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Auto-expand advanced filters if they have values
  useEffect(() => {
    if (startDate || endDate || selectedLocation) {
      setShowAdvanced(true)
    }
  }, [startDate, endDate, selectedLocation])

  const handleReset = () => {
    setSearchTerm('')
    setSelectedCategory('all')
    setSelectedStatus('all')
    setSortBy('recent')
    setFollowedOnly(false)
    setFavoritesOnly(false)
    setStartDate('')
    setEndDate('')
    setAddressQuery('')
    setSelectedLocation(null)
    setQuickFilter('all')
  }

  if (isCollapsed) {
    return (
      <div className="w-[72px] h-screen sticky top-0 border-r border-border bg-card/50 backdrop-blur-md flex flex-col items-center py-6 gap-6 transition-all duration-200 overflow-y-auto scrollbar-hide">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed?.(false)}
          className="mb-2 text-neon-green hover:bg-neon-green/10"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
        <div className="flex flex-col gap-4">
          {QUICK_FILTERS.map((f) => {
            const Icon = f.icon
            const isActive = quickFilter === f.id
            return (
              <Button
                key={f.id}
                variant="ghost"
                size="icon"
                onClick={() => setQuickFilter(f.id)}
                aria-label={f.id === 'mi_zona' ? 'Filtrar por mi zona' : `Filtrar por ${f.label.toLowerCase()}`}
                title={f.id === 'mi_zona' ? 'Mostrar reportes cerca de tu ubicación' : f.label}
                className={`relative group ${isActive ? 'text-neon-green bg-neon-green/10' : 'text-muted-foreground'}`}
              >
                <Icon className="h-5 w-5" />
                <span className="absolute left-full ml-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {f.label}
                </span>
                {isActive && <div className="absolute left-0 w-1 h-1/2 bg-neon-green rounded-r-full" />}
              </Button>
            )
          })}
        </div>
        <div className="mt-auto pb-6">
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed?.(false)}>
            <Filter className="h-5 w-5 text-muted-foreground" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <aside className="w-[280px] h-screen sticky top-0 border-r border-border bg-card/50 backdrop-blur-md flex flex-col transition-all duration-200 overflow-hidden">
      {/* Header Sidebar */}
      <div className="p-6 border-b border-border/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-neon-green" />
          <h2 className="font-bold text-lg tracking-tight">Filtros</h2>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => setIsCollapsed?.(true)}
          className="hover:bg-muted"
        >
          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
        </Button>
      </div>

      {/* Content Sidebar */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-thin scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
        
        {/* Tu Zona Block */}
        <section>
          <UserZoneCard />
        </section>

        {/* Quick Filters */}
        <section>
          <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4">Exploración Rápida</h3>
          <div className="grid grid-cols-1 gap-2">
            {QUICK_FILTERS.map((f) => {
              const Icon = f.icon
              const isActive = quickFilter === f.id
              return (
                <Button
                  key={f.id}
                  variant={isActive ? 'default' : 'ghost'}
                  onClick={() => setQuickFilter(f.id)}
                  aria-label={f.id === 'mi_zona' ? 'Filtrar por mi zona' : `Filtrar por ${f.label.toLowerCase()}`}
                  title={f.id === 'mi_zona' ? 'Mostrar reportes cerca de tu ubicación' : f.label}
                  className={`
                    justify-start gap-3 h-11 transition-all duration-200
                    ${isActive 
                      ? 'bg-neon-green/20 text-neon-green hover:bg-neon-green/30 border border-neon-green/30 px-4' 
                      : 'text-muted-foreground hover:bg-white/5 hover:text-foreground px-4'
                    }
                  `}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-neon-green' : f.color}`} />
                  <span className="font-medium text-sm">{f.label}</span>
                  {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_8px_rgba(33,255,140,0.8)]" />}
                </Button>
              )
            })}
          </div>
        </section>

        {/* Búsqueda y Selectores */}
        <section className="space-y-4 pt-4 border-t border-border/30">
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Búsqueda</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                placeholder="Título o desc..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-10 text-sm bg-black/20"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Categoría</label>
            <Select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
              <option value="all">Todas</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Estado</label>
            <Select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
              <option value="all">Todos</option>
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>{status.label}</option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Ordenar por</label>
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'oldest')}>
              <option value="recent">Más Recientes</option>
              <option value="popular">Más Populares</option>
              <option value="oldest">Más Antiguos</option>
            </Select>
          </div>
        </section>

        {/* Mi Círculo */}
        <section className="pt-4">
          <div 
            className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${followedOnly ? 'bg-neon-green/5 border-neon-green/30' : 'bg-transparent border-border/50 hover:border-border'}`}
            onClick={() => setFollowedOnly(!followedOnly)}
          >
            <div className="flex items-center gap-2">
              <Users className={`h-4 w-4 ${followedOnly ? 'text-neon-green' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${followedOnly ? 'text-foreground' : 'text-muted-foreground'}`}>Mi Círculo</span>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${followedOnly ? 'bg-neon-green/30' : 'bg-muted'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${followedOnly ? 'right-0.5 bg-neon-green' : 'left-0.5 bg-muted-foreground'}`} />
            </div>
          </div>
        </section>

        {/* Favoritos */}
        <section className="pt-2">
          <div
            className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer ${favoritesOnly ? 'bg-yellow-500/5 border-yellow-500/30' : 'bg-transparent border-border/50 hover:border-border'}`}
            onClick={() => setFavoritesOnly(!favoritesOnly)}
          >
            <div className="flex items-center gap-2">
              <Star className={`h-4 w-4 ${favoritesOnly ? 'text-yellow-400' : 'text-muted-foreground'}`} />
              <span className={`text-sm font-medium ${favoritesOnly ? 'text-foreground' : 'text-muted-foreground'}`}>Solo Favoritos</span>
            </div>
            <div className={`w-8 h-4 rounded-full relative transition-colors duration-300 ${favoritesOnly ? 'bg-yellow-400/30' : 'bg-muted'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all duration-300 ${favoritesOnly ? 'right-0.5 bg-yellow-400' : 'left-0.5 bg-muted-foreground'}`} />
            </div>
          </div>
        </section>

        {/* Filtros Avanzados */}
        <section className="pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="w-full justify-between text-muted-foreground hover:text-foreground p-0 h-auto font-bold text-xs uppercase tracking-wider"
          >
            Filtros Avanzados
            {showAdvanced ? <X className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </Button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Ubicación */}
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">Ubicación</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Dirección..."
                    value={addressQuery}
                    onChange={(e) => {
                      setAddressQuery(e.target.value)
                      if (selectedLocation && e.target.value !== selectedLocation.label) {
                        setSelectedLocation(null)
                      }
                    }}
                    className={`pl-9 h-9 text-sm bg-black/20 ${selectedLocation ? 'border-neon-green/50' : ''}`}
                  />
                  {selectedLocation && (
                    <button onClick={() => { setSelectedLocation(null); setAddressQuery('') }} className="absolute right-2 top-1/2 -translate-y-1/2">
                      <X className="h-3 w-3 text-muted-foreground" />
                    </button>
                  )}
                </div>
                
                {addressSuggestions.length > 0 && !selectedLocation && (
                  <div className="absolute left-6 right-6 mt-1 bg-zinc-900 border border-border rounded shadow-xl z-50 max-h-40 overflow-y-auto">
                    {addressSuggestions.map((s, i) => (
                      <button
                        key={i}
                        className="w-full text-left px-3 py-2 hover:bg-white/5 text-xs border-b border-white/5 last:border-0"
                        onClick={() => {
                          setSelectedLocation({ lat: s.location.lat, lng: s.location.lng, label: s.original })
                          setAddressQuery(s.original)
                          setAddressSuggestions([])
                        }}
                      >
                        <div className="font-medium">{s.original}</div>
                        <div className="text-[10px] text-muted-foreground">{s.locality}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Desde</label>
                  <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-8 text-[10px] px-2 [color-scheme:dark]" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase">Hasta</label>
                  <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-8 text-[10px] px-2 [color-scheme:dark]" />
                </div>
              </div>

              {cityName && quickFilter === 'mi_zona' && (
                <div className="flex items-center gap-2 p-2 bg-neon-green/10 rounded border border-neon-green/20">
                  <MapPin className="h-3 w-3 text-neon-green" />
                  <span className="text-[10px] text-neon-green font-medium">Ciudad activa: {cityName}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Reset */}
        <div className="pt-6">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full h-9 text-xs gap-2 border-border/50 text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" />
            Reiniciar Filtros
          </Button>
        </div>
      </div>
    </aside>
  )
}
