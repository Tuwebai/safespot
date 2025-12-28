import { useState, useEffect } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { MapPin, Search, Navigation } from 'lucide-react'
import { useDebounce } from '@/hooks/useDebounce'
import { normalizeAddress, normalizeSearchResult } from '@/lib/address-utils'

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
  address?: {
    road?: string
    house_number?: string
    suburb?: string
    neighbourhood?: string
    city?: string
    state?: string
    [key: string]: string | undefined
  }
}

export function LocationSelector({ value, onChange, error }: LocationSelectorProps) {
  const toast = useToast()
  const [searchQuery, setSearchQuery] = useState(value.location_name || '')
  const [suggestions, setSuggestions] = useState<NominatimResult[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [lastRequestTime, setLastRequestTime] = useState(0)

  const debouncedQuery = useDebounce(searchQuery, 300)
  const MIN_REQUEST_INTERVAL = 1000 // Rate limit: max 1 request per second

  // Search addresses using Nominatim - RESTRICTED TO ARGENTINA
  useEffect(() => {
    if (!debouncedQuery || debouncedQuery.length < 3) {
      setSuggestions([])
      return
    }

    // Rate limiting check
    const now = Date.now()
    const timeSinceLastRequest = now - lastRequestTime

    if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
      // Wait before making request
      const timeout = setTimeout(() => {
        performSearch()
      }, MIN_REQUEST_INTERVAL - timeSinceLastRequest)

      return () => clearTimeout(timeout)
    }

    // Make request immediately
    performSearch()

    function performSearch() {
      setIsLoading(true)
      setLastRequestTime(Date.now())

      // AbortController for cancelling previous requests
      const abortController = new AbortController()

      // CRITICAL: Restrict to Argentina only (countrycodes=ar)
      const params = new URLSearchParams({
        format: 'json',
        q: debouncedQuery,
        limit: '5',
        countrycodes: 'ar',
        addressdetails: '1'
      })

      // If user has coordinates, add them to prioritize nearby results
      if (value.latitude && value.longitude) {
        params.append('lat', value.latitude.toString())
        params.append('lon', value.longitude.toString())
      }

      fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        signal: abortController.signal,
        headers: {
          'User-Agent': 'SafeSpot App'
        }
      })
        .then(res => res.json())
        .then((data: NominatimResult[]) => {
          // Filter to ensure only Argentina results
          const argentinaResults = data
            .filter(result => {
              const displayName = result.display_name.toLowerCase()

              // Check for Argentina indicators
              const isArgentina =
                displayName.includes('argentina') ||
                displayName.includes('buenos aires') ||
                displayName.includes('caba') ||
                displayName.includes('córdoba') ||
                displayName.includes('rosario') ||
                displayName.includes('mendoza') ||
                displayName.includes('tucumán') ||
                displayName.includes('salta') ||
                displayName.includes('santa fe') ||
                displayName.includes('la plata') ||
                displayName.includes('mar del plata') ||
                displayName.includes('bariloche') ||
                displayName.includes('ushuaia') ||
                displayName.includes('neuquén') ||
                displayName.includes('comodoro rivadavia') ||
                displayName.includes('provincia de') ||
                true

              // Exclude obvious non-Argentina results
              const isNotArgentina =
                displayName.includes(', chile') ||
                displayName.includes(', uruguay') ||
                displayName.includes(', paraguay') ||
                displayName.includes(', brasil') ||
                displayName.includes(', brazil') ||
                displayName.includes(', colombia') ||
                displayName.includes(', méxico') ||
                displayName.includes(', mexico') ||
                displayName.includes(', españa') ||
                displayName.includes(', spain')

              return isArgentina && !isNotArgentina
            })
            .map(result => ({
              ...result,
              display_name: normalizeSearchResult(result.display_name)
            }))

          setSuggestions(argentinaResults)
          setShowSuggestions(true)
        })
        .catch((error) => {
          if (error.name === 'AbortError') {
            // Request was cancelled, this is expected
            return
          }
          console.debug('Nominatim search error:', error)
          setSuggestions([])
        })
        .finally(() => setIsLoading(false))

      // Cleanup: abort request if component unmounts or query changes
      return () => abortController.abort()
    }
  }, [debouncedQuery, value.latitude, value.longitude, lastRequestTime, MIN_REQUEST_INTERVAL])

  const handleSelectSuggestion = (suggestion: NominatimResult) => {
    const location: LocationData = {
      location_name: suggestion.display_name,
      latitude: parseFloat(suggestion.lat),
      longitude: parseFloat(suggestion.lon),
      location_source: 'geocoded' // From Nominatim autocomplete
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

    // CRITICAL: Configure geolocation with proper options
    const geolocationOptions: PositionOptions = {
      enableHighAccuracy: true, // Use GPS if available
      timeout: 15000, // 15 seconds timeout
      maximumAge: 60000 // Accept cached position up to 1 minute old
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude
        const lon = position.coords.longitude

        // CRITICAL: Try to get a normalized, human-readable address from coordinates
        let locationName = ''

        try {
          // Reverse geocode to get address name
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&countrycodes=ar`,
            {
              headers: {
                'User-Agent': 'SafeSpot App'
              }
            }
          )

          if (response.ok) {
            const data = await response.json()
            // CRITICAL: Normalize address to show only relevant parts
            locationName = normalizeAddress(data)
          }
        } catch (error) {
          // Non-critical: if reverse geocoding fails, log but don't show error
          console.debug('Reverse geocoding failed:', error)
        }

        // CRITICAL: If we couldn't get a normalized address, use a generic message
        // Don't show raw coordinates to the user
        if (!locationName || locationName.trim().length === 0) {
          locationName = 'Ubicación actual'
        }

        const location: LocationData = {
          location_name: locationName,
          latitude: lat,
          longitude: lon,
          location_source: 'gps' // From device GPS
        }
        onChange(location)
        setSearchQuery(locationName)
        setIsLoading(false)
      },
      (error) => {
        // CRITICAL: Show clear, human-friendly error messages
        let errorMessage = 'No pudimos obtener tu ubicación. Probá ingresarla manualmente.'

        // Log detailed error for debugging
        console.debug('Geolocation error:', {
          code: error.code,
          message: error.message,
          PERMISSION_DENIED: error.PERMISSION_DENIED,
          POSITION_UNAVAILABLE: error.POSITION_UNAVAILABLE,
          TIMEOUT: error.TIMEOUT
        })

        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'No pudimos obtener tu ubicación. Probá ingresarla manualmente.'
            break
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'No pudimos obtener tu ubicación. Probá ingresarla manualmente.'
            break
          case error.TIMEOUT:
            errorMessage = 'La ubicación tardó demasiado. Probá ingresarla manualmente.'
            break
          default:
            errorMessage = 'No pudimos obtener tu ubicación. Probá ingresarla manualmente.'
        }

        toast.error(errorMessage)
        setIsLoading(false)
      },
      geolocationOptions
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
        {isLoading ? 'Obteniendo ubicación...' : 'Usar mi ubicación actual'}
      </Button>

      {/* Helper text */}
      <p className="text-xs text-muted-foreground">
        Podés escribir barrio, calle y ciudad. No hace falta la dirección completa.
        <br />
        Ejemplos: "Palermo, Buenos Aires" o "Av. Corrientes 1200, CABA"
      </p>

      {/* Location Source Badge */}
      {value.location_source && value.location_name && (
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${value.location_source === 'gps'
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : value.location_source === 'geocoded'
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : value.location_source === 'manual'
                  ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  : 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
            }`}>
            {value.location_source === 'gps' && '📍 GPS Preciso'}
            {value.location_source === 'geocoded' && '🗺️ Geolocalizado'}
            {value.location_source === 'manual' && '✏️ Ingreso Manual'}
            {value.location_source === 'estimated' && '⚠️ Ubicación Estimada'}
          </span>
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive mt-1">{error}</div>
      )}
    </div>
  )
}

