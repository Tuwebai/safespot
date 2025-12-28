import { useState, useEffect, useRef } from 'react'

interface NominatimResult {
    display_name: string
    lat: string
    lon: string
}

const DEBOUNCE_MS = 300

/**
 * Custom hook for location search using backend geocoding proxy
 * 
 * CRITICAL: This hook now uses /api/geocode/search instead of direct Nominatim calls
 * This fixes mobile CORS and 403 Forbidden issues
 */
export function useLocationSearch(query: string) {
    const [isSearching, setIsSearching] = useState(false)
    const [results, setResults] = useState<NominatimResult[]>([])
    const [error, setError] = useState<string | null>(null)

    const abortControllerRef = useRef<AbortController | null>(null)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        // Clear previous debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // Reset if query is too short
        if (!query || query.trim().length < 3) {
            setResults([])
            setIsSearching(false)
            setError(null)
            return
        }

        // Debounce search
        debounceTimerRef.current = setTimeout(async () => {
            // Cancel previous request
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }

            // Create new AbortController for this request
            const controller = new AbortController()
            abortControllerRef.current = controller

            setIsSearching(true)
            setError(null)

            try {
                // CRITICAL: Use backend proxy instead of direct Nominatim call
                // This fixes mobile CORS and 403 issues
                const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
                const url = new URL(`${API_BASE_URL}/geocode/search`)
                url.searchParams.set('q', query.trim())
                url.searchParams.set('limit', '5')
                url.searchParams.set('countrycodes', 'ar')

                const response = await fetch(url.toString(), {
                    signal: controller.signal,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                })

                // If request was aborted, don't update state
                if (controller.signal.aborted) {
                    return
                }

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}))

                    if (response.status === 429) {
                        throw new Error('Demasiadas búsquedas. Esperá un segundo.')
                    }

                    throw new Error(errorData.message || 'Error al buscar dirección')
                }

                const data = await response.json()

                // Validate response structure
                if (!data.success || !Array.isArray(data.data)) {
                    throw new Error('Respuesta inválida del servidor')
                }

                setResults(data.data)
                setError(null)

            } catch (err: any) {
                // Don't show error if request was aborted (user is still typing)
                if (err.name === 'AbortError') {
                    return
                }

                console.error('Location search error:', err)
                setError(err.message || 'No se pudo buscar la dirección')
                setResults([])
            } finally {
                // Only update loading state if this is still the current request
                if (abortControllerRef.current === controller) {
                    setIsSearching(false)
                }
            }
        }, DEBOUNCE_MS)

        // Cleanup function
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [query])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort()
            }
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current)
            }
        }
    }, [])

    return { isSearching, results, error }
}
