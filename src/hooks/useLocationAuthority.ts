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

    // ✅ FIX: Unified effect - setFallbacks THEN autoRequest
    // This eliminates the race condition where autoRequest fired before fallbacks were set
    useEffect(() => {
        // 1. Set fallbacks first (if any)
        const fallbacks: LocationFallbacks = {}

        if (initialFocus) {
            fallbacks.initialFocus = initialFocus
        }
        if (zones && zones.length > 0) {
            fallbacks.zones = zones
        }
        if (lastKnown) {
            fallbacks.lastKnown = lastKnown
        }

        const hasFallbacks = Object.keys(fallbacks).length > 0
        if (hasFallbacks) {
            locationAuthority.setFallbacks(fallbacks)
        }

        // 2. THEN trigger autoRequest if enabled and not resolved
        // Only trigger if we have fallbacks OR if none are expected (no zones/lastKnown data passed)
        const currentState = locationAuthority.getState()
        if (autoRequest && currentState === LocationState.UNKNOWN) {
            // If we have fallbacks, they're now set. If not, we go to GPS.
            locationAuthority.requestLocation('auto')
        }
    }, [autoRequest, initialFocus, zones, lastKnown])

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
