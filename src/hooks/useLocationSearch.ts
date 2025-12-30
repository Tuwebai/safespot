import { useState, useEffect, useRef } from 'react'

interface NominatimResult {
    display_name: string
    lat: string
    lon: string
    name?: string
    address?: {
        road?: string
        street?: string
        pedestrian?: string
        house_number?: string
        number?: string
        city?: string
        town?: string
        village?: string
        municipality?: string
        state?: string
        province?: string
        [key: string]: string | undefined
    }
}

const DEBOUNCE_MS = 500

/**
 * Custom hook for location search using backend geocoding proxy
 * Includes robust debounce, request cancellation, and rate limiting handling.
 */
export function useLocationSearch(query: string) {
    const [isSearching, setIsSearching] = useState(false)
    const [results, setResults] = useState<NominatimResult[]>([])
    const [error, setError] = useState<string | null>(null)
    const [isRateLimited, setIsRateLimited] = useState(false)

    const abortControllerRef = useRef<AbortController | null>(null)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [isBlocked, setIsBlocked] = useState(false)

    useEffect(() => {
        // 1. Cancel any in-flight request IMMEDIATELY when query changes
        if (abortControllerRef.current) {
            abortControllerRef.current.abort()
            abortControllerRef.current = null
        }

        // 2. Clear previous debounce timer
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current)
        }

        // 3. Reset state specific to rate limiting on new input
        // Only reset if NOT blocked. If blocked, we wait.
        if (!isBlocked) {
            setIsRateLimited(false)
        }

        // 4. Validate query length and Block status
        if (!query || query.trim().length < 3 || isBlocked) {
            if (!isBlocked) {
                setResults([])
                setIsSearching(false)
                setError(null)
            }
            return
        }

        // 5. Start Debounce Timer
        debounceTimerRef.current = setTimeout(async () => {
            const controller = new AbortController()
            abortControllerRef.current = controller

            setIsSearching(true)
            setError(null)

            try {
                const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
                const url = new URL(`${API_BASE_URL}/geocode/search`)
                url.searchParams.set('q', query.trim())
                url.searchParams.set('limit', '5')
                url.searchParams.set('countrycodes', 'ar')
                url.searchParams.set('addressdetails', '1') // Request address details for normalization
                // Removed viewbox restriction to allow searching all of Argentina as requested

                const response = await fetch(url.toString(), {
                    signal: controller.signal,
                    headers: { 'Content-Type': 'application/json' }
                })

                if (controller.signal.aborted) return

                if (!response.ok) {
                    if (response.status === 429) {
                        setIsRateLimited(true)
                        setIsBlocked(true)
                        setError('Demasiadas búsquedas, esperá un momento...')
                        setIsSearching(false)

                        // Unblock after 1s
                        setTimeout(() => setIsBlocked(false), 1500)
                        return
                    }

                    const errorData = await response.json().catch(() => ({}))
                    throw new Error(errorData.message || 'Error al buscar dirección')
                }

                const data = await response.json()

                if (!data.success || !Array.isArray(data.data)) {
                    throw new Error('Respuesta inválida del servidor')
                }

                // Normalization Logic
                const normalizedResults = (data.data as NominatimResult[]).map((item) => {
                    let displayName = item.display_name

                    // Specific addressing normalization if address details are present
                    // Try to construct: Street Number, City, Province
                    if (item.address) {
                        const parts = []
                        const addr = item.address

                        // 1. Street + Number
                        const road = addr.road || addr.street || addr.pedestrian
                        const houseNumber = addr.house_number || addr.number

                        if (road) {
                            parts.push(houseNumber ? `${road} ${houseNumber}` : road)
                        } else if (item.name) {
                            parts.push(item.name)
                        }

                        // 2. City / Town / Village
                        // Prioritize City > Town > Village > Hamelt
                        const city = addr.city || addr.town || addr.village || addr.municipality
                        if (city) parts.push(city)

                        // 3. Province (State)
                        const state = addr.state || addr.province
                        if (state) parts.push(state)

                        // Only replace if we have enough parts to look good
                        if (parts.length >= 2) {
                            displayName = parts.join(', ')
                        }
                    }

                    // Fallback cleaner if no detailed structure found (clean up 'Pedanía', etc from string)
                    displayName = displayName
                        .replace(/Pedanía [^,]+,?\s?/gi, '')
                        .replace(/Departamento [^,]+,?\s?/gi, '')
                        .replace(/Partido de [^,]+,?\s?/gi, '')
                        .replace(/, Argentina$/, '') // Remove trailing Country

                    return {
                        ...item,
                        display_name: displayName
                    }
                })

                setResults(normalizedResults)


            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') return
                console.error('Location search error:', err)
                setError(err instanceof Error ? err.message : 'No se pudo buscar la dirección')
            } finally {
                if (abortControllerRef.current === controller) {
                    setIsSearching(false)
                    abortControllerRef.current = null
                }
            }
        }, DEBOUNCE_MS)

        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
            if (abortControllerRef.current) abortControllerRef.current.abort()
        }
    }, [query, isBlocked]) // Added isBlocked dependency to re-trigger if needed, though usually query changes drive this

    return {
        isSearching,
        results,
        error,
        isRateLimited
    }
}

