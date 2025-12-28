import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { MapPin, Search, Navigation, AlertCircle, X } from 'lucide-react'
import { useLocationSearch } from '@/hooks/useLocationSearch'
import { useGeolocation } from '@/hooks/useGeolocation'

export interface LocationData {
  location_name: string
  latitude?: number
  longitude?: number
  location_source?: 'gps' | 'geocoded' | 'manual' | 'estimated'
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
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [hasConfirmedSelection, setHasConfirmedSelection] = useState(false)

  // Separate states for search and GPS
  const { isSearching, results, error: searchError } = useLocationSearch(searchQuery)
  const { isLocating, getCurrentLocation, cleanup } = useGeolocation({
    timeout: 10000,
    enableHighAccuracy: true
  })

  // Sync ONLY when parent resets (e.g., form reset) - detect by checking if value is empty
  useEffect(() => {
    if (!value.location_name && !value.latitude && !value.longitude) {
      // Parent cleared the form
      setSearchQuery('')
      setHasConfirmedSelection(false)
    } else if (value.location_name && value.latitude && value.longitude && !hasConfirmedSelection) {
      // Parent set initial value (e.g., editing existing report)
      setSearchQuery(value.location_name)
      setHasConfirmedSelection(true)
    }
  }, [value.location_name, value.latitude, value.longitude])

  // Cleanup geolocation on unmount
  useEffect(() => {
    return () => {
      cleanup()
    }
  }, [])

  const handleInputChange = (newValue: string) => {
    setSearchQuery(newValue)
    setShowSuggestions(true)

    // CRITICAL: If user edits after confirming, INVALIDATE the selection
    if (hasConfirmedSelection) {
      setHasConfirmedSelection(false)
      // Clear parent's location data
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

    // CRITICAL: Mark as confirmed
    setHasConfirmedSelection(true)
    onChange(location)
    setSearchQuery(suggestion.display_name)
    setShowSuggestions(false)
  }

  const handleClearSelection = () => {
    setSearchQuery('')
    setHasConfirmedSelection(false)
    setShowSuggestions(false)
    onChange({
      location_name: '',
      latitude: undefined,
      longitude: undefined,
      location_source: undefined
    })
  }

  const handleUseCurrentLocation = async () => {
    try {
      const coords = await getCurrentLocation()

      if (!coords) {
        toast.error('No se pudo obtener la ubicación')
        return
      }

      const { latitude, longitude } = coords
      let locationName = ''

      // Reverse geocoding using backend proxy
      try {
        const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
        const url = new URL(`${API_BASE_URL}/geocode/reverse`)
        url.searchParams.set('lat', latitude.toString())
        url.searchParams.set('lon', longitude.toString())

        const response = await fetch(url.toString(), {
          headers: {
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const result = await response.json()
          if (result.success && result.data) {
            locationName = result.data.display_name || ''
          }
        }
      } catch (err) {
        console.error('Reverse geocoding failed:', err)
      }

      if (!locationName || locationName.trim().length === 0) {
        locationName = 'Ubicación actual'
      }

      // CRITICAL: Always save with coordinates
      const location: LocationData = {
        location_name: locationName,
        latitude,
        longitude,
        location_source: 'gps'
      }

      setHasConfirmedSelection(true)
      onChange(location)
      setSearchQuery(locationName)

    } catch (err: any) {
      let errorMessage = 'No pudimos obtener tu ubicación.'

      if (err?.code === 1) {
        errorMessage = 'Permiso denegado. Habilitá la ubicación en tu navegador.'
      } else if (err?.code === 2) {
        errorMessage = 'Ubicación no disponible. Verificá tu conexión GPS.'
      } else if (err?.code === 3 || err?.isTimeout) {
        errorMessage = 'Se agotó el tiempo de espera. Probá de nuevo.'
      }

      toast.error(errorMessage)
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
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
            placeholder="Busca una dirección..."
            className={`pl-10 ${error ? 'border-destructive' : ''} ${hasConfirmedSelection ? 'pr-10' : ''}`}
            disabled={isLocating}
          />
          {hasConfirmedSelection && searchQuery && (
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
        {showSuggestions && results.length > 0 && !hasConfirmedSelection && (
          <div className="absolute z-10 w-full mt-1 bg-dark-card border border-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {results.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-neon-green/10 transition-colors border-b border-dark-border last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-neon-green flex-shrink-0" />
                  <span className="text-sm text-foreground">{suggestion.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Search loading indicator */}
        {isSearching && !hasConfirmedSelection && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-neon-green border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      {/* Search error */}
      {searchError && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{searchError}</span>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={handleUseCurrentLocation}
        disabled={isLocating || isSearching}
        className="w-full"
      >
        <Navigation className={`h-4 w-4 mr-2 ${isLocating ? 'animate-pulse' : ''}`} />
        {isLocating ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
      </Button>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Podés escribir barrio, calle y ciudad. No hace falta la dirección completa.
        <br />
        Ejemplos: "Palermo, Buenos Aires" o "Av. Corrientes 1200, CABA"
      </p>

      {/* Location Source Badge */}
      {value.location_source && value.location_name && hasConfirmedSelection && (
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${value.location_source === 'gps'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : value.location_source === 'geocoded'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : value.location_source === 'manual'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
              }`}
          >
            {value.location_source === 'gps' && '📍 GPS Preciso'}
            {value.location_source === 'geocoded' && '🗺️ Geolocalizado'}
            {value.location_source === 'manual' && '✏️ Ingreso Manual'}
            {value.location_source === 'estimated' && '⚠️ Ubicación Estimada'}
          </span>
        </div>
      )}

      {/* Validation error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          <span>{error}</span>
        </div>
      )}
    </div>
  )
}
