/**
 * useLocationAuthority Hook
 * 
 * React integration for the Location Authority Engine (Motor 5).
 * Provides reactive state and actions for location management.
 * 
 * Usage:
 * const { state, position, requestLocation, retry, isResolved, isDenied } = useLocationAuthority()
 */

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react'
import {
    locationAuthority,
    LocationState,
    type LocationPosition,
    type LocationFallbacks
} from '@/engine/location/LocationAuthorityEngine'

interface UseLocationAuthorityOptions {
    /** Initial focus point (e.g., from deep link) */
    initialFocus?: { lat: number; lng: number } | null
    /** User zones for fallback */
    zones?: Array<{ type: string; lat: number; lng: number }> | null
    /** Last known location from settings */
    lastKnown?: { lat: number; lng: number } | null
    /** Auto-request location on mount */
    autoRequest?: boolean
}

interface UseLocationAuthorityReturn {
    // State
    state: LocationState
    position: LocationPosition | null
    statusMessage: string
    lastResolvedAt: number | null

    // Actions
    requestLocation: (mode?: 'auto' | 'manual') => Promise<void>
    retry: () => Promise<void>
    abort: () => void

    // Derived state
    isResolved: boolean
    isDenied: boolean
    isUnavailable: boolean
    isResolving: boolean
}

/**
 * Subscribe to location authority state changes
 */
function subscribeToLocationAuthority(callback: () => void): () => void {
    return locationAuthority.subscribe(() => callback())
}

/**
 * Get current snapshot of location authority state
 */
function getLocationSnapshot(): LocationState {
    return locationAuthority.getState()
}

export function useLocationAuthority(
    options: UseLocationAuthorityOptions = {}
): UseLocationAuthorityReturn {
    const {
        initialFocus,
        zones,
        lastKnown,
        autoRequest = false
    } = options

    // React 18 useSyncExternalStore for state subscription
    const state = useSyncExternalStore(
        subscribeToLocationAuthority,
        getLocationSnapshot,
        getLocationSnapshot // Server snapshot
    )

    // Position needs separate tracking since useSyncExternalStore expects primitive/ref equality
    const [position, setPosition] = useState<LocationPosition | null>(locationAuthority.getPosition())
    const [statusMessage, setStatusMessage] = useState<string>(locationAuthority.getStatusMessage())

    // Sync position and status message on state changes
    useEffect(() => {
        const unsubscribe = locationAuthority.subscribe((_state, pos) => {
            setPosition(pos)
            setStatusMessage(locationAuthority.getStatusMessage())
        })
        return unsubscribe
    }, [])

    // Set fallbacks when they change
    useEffect(() => {
        const fallbacks: LocationFallbacks = {}

        if (initialFocus) {
            fallbacks.initialFocus = initialFocus
        }
        if (zones) {
            fallbacks.zones = zones
        }
        if (lastKnown) {
            fallbacks.lastKnown = lastKnown
        }

        if (Object.keys(fallbacks).length > 0) {
            locationAuthority.setFallbacks(fallbacks)
        }
    }, [initialFocus, zones, lastKnown])

    // Auto-request on mount if enabled and not already resolved
    useEffect(() => {
        if (autoRequest && state === LocationState.UNKNOWN) {
            locationAuthority.requestLocation('auto')
        }
    }, [autoRequest, state])

    // Actions
    const requestLocation = useCallback(async (mode: 'auto' | 'manual' = 'auto') => {
        await locationAuthority.requestLocation(mode)
    }, [])

    const retry = useCallback(async () => {
        await locationAuthority.retry()
    }, [])

    const abort = useCallback(() => {
        locationAuthority.abort()
    }, [])

    return {
        // State
        state,
        position,
        statusMessage,
        lastResolvedAt: locationAuthority.getLastResolvedAt(),

        // Actions
        requestLocation,
        retry,
        abort,

        // Derived state
        isResolved: state === LocationState.RESOLVED && position !== null,
        isDenied: state === LocationState.DENIED,
        isUnavailable: state === LocationState.UNAVAILABLE,
        isResolving: state === LocationState.RESOLVING
    }
}

// Re-export types and state enum for convenience
export { LocationState, type LocationPosition }
