import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'
import { MapPin, Search, AlertCircle, X } from 'lucide-react'
import { useLocationSearch } from '@/hooks/useLocationSearch'
import { MiniMapPreview } from './location/MiniMapPreview'

export interface LocationData {
  location_name: string
  latitude?: number
  longitude?: number
  location_source?: 'geocoded' | 'manual' | 'estimated'
}

interface LocationSelectorProps {
  value: LocationData
  onChange: (location: LocationData) => void
  error?: string
}

interface NominatimResult {
  display_name: string
  lat: string
  lon: string
}

export function LocationSelector({ value, onChange, error }: LocationSelectorProps) {
  const toast = useToast()
  // Init search query from prop to ensure sync on mount
  const [searchQuery, setSearchQuery] = useState(value.location_name || '')
  const [showSuggestions, setShowSuggestions] = useState(false)

  // ✅ Derived state: Source of Truth is the props (controlled component)
  // This eliminates the desync bugs by definition
  const isConfirmed = !!(value.location_name && value.latitude && value.longitude)

  // Ref to track if the update was internal (blocking the echo from prop update)
  const isInternalChangeRef = useRef(false)

  // Use only search hook
  const { isSearching, results, error: searchError, isRateLimited } = useLocationSearch(searchQuery)

  // Sync effect with COMPLETE dependencies
  useEffect(() => {
    // If we just triggered the change internally, skip this sync to preserve cursor/state
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }

    // Case 1: External valid value (Initial load or programmatic set)
    if (isConfirmed) {
      if (searchQuery !== value.location_name) {
        setSearchQuery(value.location_name)
      }
    }
    // Case 2: Parent cleared the form
    else if (!value.location_name && !value.latitude && !value.longitude) {
      if (searchQuery !== '') {
        setSearchQuery('')
      }
    }
    // Note: We intentionally don't sync if properities are partial/invalid, keeping user input
  }, [value.location_name, value.latitude, value.longitude, isConfirmed, searchQuery])

  const handleInputChange = (newValue: string) => {
    setSearchQuery(newValue)
    setShowSuggestions(true)

    // CRITICAL: If user edits after confirming, INVALIDATE the selection
    if (isConfirmed) {
      isInternalChangeRef.current = true
      // Clear parent's location data but keep user text
      onChange({
        location_name: '',
        latitude: undefined,
        longitude: undefined,
        location_source: undefined
      })
    }
  }

  const handleSelectSuggestion = (suggestion: NominatimResult) => {
    const lat = parseFloat(suggestion.lat)
    const lon = parseFloat(suggestion.lon)

    // CRITICAL: Always save with coordinates
    if (isNaN(lat) || isNaN(lon)) {
      toast.error('Ubicación inválida. Por favor, selecciona otra.')
      return
    }

    const location: LocationData = {
      location_name: suggestion.display_name,
      latitude: lat,
      longitude: lon,
      location_source: 'geocoded'
    }

    // Update local state first for immediate feedback
    setSearchQuery(suggestion.display_name)
    setShowSuggestions(false)

    // Update parent
    onChange(location)
  }

  const handleClearSelection = () => {
    setSearchQuery('')
    setShowSuggestions(false)
    // No need for ref flag here as we want both to be empty
    onChange({
      location_name: '',
      latitude: undefined,
      longitude: undefined,
      location_source: undefined
    })
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <label className="text-sm font-medium mb-2 block text-foreground/80">Busca la dirección o zona del incidente</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/50" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => {
              // Delay to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 200)
            }}
            placeholder="Ej: Av. Colón 1200, Córdoba"
            className={`pl-10 h-12 text-lg ${error ? 'border-destructive' : ''} ${isConfirmed ? 'pr-10 border-neon-green/50 bg-neon-green/5' : ''}`}
          />
          {isConfirmed && searchQuery && (
            <button
              type="button"
              onClick={handleClearSelection}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-foreground/50 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && results.length > 0 && !isConfirmed && (
          <div className="absolute z-10 w-full mt-1 bg-dark-card border border-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-neon-green/10 transition-colors border-b border-dark-border last:border-b-0 group"
              >
                <div className="flex items-center gap-3">
                  <div className="bg-dark-bg p-2 rounded-full group-hover:bg-neon-green/20 transition-colors">
                    <MapPin className="h-4 w-4 text-neon-green flex-shrink-0" />
                  </div>
                  <span className="text-sm text-foreground font-medium">{suggestion.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Search loading indicator */}
        {isSearching && !isConfirmed && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-5 w-5 border-2 border-neon-green border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Search error */}
      {searchError && (
        <div className={`flex items-center gap-2 text-sm p-3 rounded-md border ${isRateLimited
          ? 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20'
          : 'text-destructive bg-destructive/10 border-destructive/20'
          }`}>
          <AlertCircle className="h-4 w-4" />
          <span>{searchError}</span>
        </div>
      )}

      {/* MiniMap Preview (Always visible for placeholder or map) */}
      <MiniMapPreview lat={value.latitude} lng={value.longitude} />

      {/* Helper text */}
      <p className="text-xs text-muted-foreground flex items-center gap-2 bg-dark-bg p-2 rounded border border-dark-border/50">
        <MapPin className="h-3 w-3" />
        Se recomienda ingresar calle y altura aproximada para mayor precisión.
      </p>

      {/* Location Source Badge */}
      {value.location_source && value.location_name && isConfirmed && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${value.location_source === 'geocoded'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : value.location_source === 'manual'
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}
          >
            {value.location_source === 'geocoded' && '🗺️ Ubicación Verificada'}
            {value.location_source === 'manual' && '✏️ Ingreso Manual'}
            {value.location_source === 'estimated' && '⚠️ Ubicación Estimada'}
          </span>
        </div>
      )}

      {/* Validation error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive font-medium animate-pulse">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
