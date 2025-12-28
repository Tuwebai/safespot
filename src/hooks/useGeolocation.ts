import { useState, useCallback, useRef } from 'react'

interface GeolocationCoords {
    latitude: number
    longitude: number
    accuracy: number
}

interface GeolocationError {
    code: number
    message: string
    isTimeout?: boolean
}

interface UseGeolocationOptions {
    timeout?: number
    maximumAge?: number
    enableHighAccuracy?: boolean
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
    const {
        timeout = 10000,
        maximumAge = 60000,
        enableHighAccuracy = true
    } = options

    const [isLocating, setIsLocating] = useState(false)
    const [coords, setCoords] = useState<GeolocationCoords | null>(null)
    const [error, setError] = useState<GeolocationError | null>(null)

    // Track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true)
    const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const getCurrentLocation = useCallback(async (): Promise<GeolocationCoords> => {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                const err: GeolocationError = {
                    code: 0,
                    message: 'Geolocalización no soportada por el navegador'
                }
                if (isMountedRef.current) {
                    setError(err)
                    setIsLocating(false)
                }
                reject(err)
                return
            }

            if (isMountedRef.current) {
                setIsLocating(true)
                setError(null)
            }

            let hasResponded = false

            // Manual timeout implementation (more reliable than native timeout)
            timeoutIdRef.current = setTimeout(() => {
                if (!hasResponded && isMountedRef.current) {
                    hasResponded = true
                    const err: GeolocationError = {
                        code: 3,
                        message: 'Se agotó el tiempo de espera',
                        isTimeout: true
                    }
                    setError(err)
                    setIsLocating(false)
                    reject(err)
                }
            }, timeout)

            const successHandler = (position: GeolocationPosition) => {
                if (hasResponded) return
                hasResponded = true

                if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current)
                }

                const locationCoords: GeolocationCoords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                }

                if (isMountedRef.current) {
                    setCoords(locationCoords)
                    setError(null)
                    setIsLocating(false)
                }

                resolve(locationCoords)
            }

            const errorHandler = (err: GeolocationPositionError) => {
                if (hasResponded) return
                hasResponded = true

                if (timeoutIdRef.current) {
                    clearTimeout(timeoutIdRef.current)
                }

                const geoError: GeolocationError = {
                    code: err.code,
                    message: err.message
                }

                if (isMountedRef.current) {
                    setError(geoError)
                    setCoords(null)
                    setIsLocating(false)
                }

                reject(geoError)
            }

            navigator.geolocation.getCurrentPosition(
                successHandler,
                errorHandler,
                {
                    enableHighAccuracy,
                    timeout, // Also pass native timeout as fallback
                    maximumAge
                }
            )
        })
    }, [timeout, maximumAge, enableHighAccuracy])

    // Cleanup on unmount
    const cleanup = useCallback(() => {
        isMountedRef.current = false
        if (timeoutIdRef.current) {
            clearTimeout(timeoutIdRef.current)
        }
    }, [])

    return {
        isLocating,
        coords,
        error,
        getCurrentLocation,
        cleanup
    }
}
