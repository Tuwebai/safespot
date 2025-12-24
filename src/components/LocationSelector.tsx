import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { MapPin, Search, Navigation } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'

export interface LocationData {
  location_name: string
  latitude?: number
  longitude?: number
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
  const [searchQuery, setSearchQuery] = useState(value.location_name || '')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const debouncedQuery = useDebounce(searchQuery, 300)

  // Search addresses using Nominatim
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setSuggestions([])
      return
    }

    setIsLoading(true)
    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedQuery)}&limit=5`, {
      headers: {
        'User-Agent': 'SafeSpot App'
      }
    })
      .then(res => res.json())
      .then((data: NominatimResult[]) => {
        setSuggestions(data)
        setShowSuggestions(true)
      })
      .catch(() => {
        setSuggestions([])
      })
      .finally(() => setIsLoading(false))
  }, [debouncedQuery])

  const handleSelectSuggestion = (suggestion: NominatimResult) => {
    const location: LocationData = {
      location_name: suggestion.display_name,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon)
    }
    onChange(location)
    setSearchQuery(suggestion.display_name)
    setShowSuggestions(false)
  }

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.warning('Geolocalización no está disponible en tu navegador')
      return
    }

    setIsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const location: LocationData = {
          location_name: `${position.coords.latitude}, ${position.coords.longitude}`,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }
        onChange(location)
        setSearchQuery(location.location_name)
        setIsLoading(false)
      },
      () => {
        toast.error('No se pudo obtener tu ubicación')
        setIsLoading(false)
      }
    )
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-foreground/50" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            placeholder="Busca una dirección..."
            className={`pl-10 ${error ? 'border-destructive' : ''}`}
          />
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-dark-card border border-dark-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="w-full text-left px-4 py-2 hover:bg-neon-green/10 transition-colors border-b border-dark-border last:border-b-0"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-neon-green" />
                  <span className="text-sm text-foreground">{suggestion.display_name}</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="animate-spin h-4 w-4 border-2 border-neon-green border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleUseCurrentLocation}
        disabled={isLoading}
        className="w-full"
      >
        <Navigation className="h-4 w-4 mr-2" />
        Usar mi ubicación actual
      </Button>

      {value.latitude && value.longitude && (
        <div className="text-sm text-foreground/70">
          <MapPin className="h-4 w-4 inline mr-1" />
          Coordenadas: {value.latitude.toFixed(6)}, {value.longitude.toFixed(6)}
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive mt-1">{error}</div>
      )}
    </div>
  )
}

