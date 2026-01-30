import { create } from 'zustand'

// ============================================
// TYPES
// ============================================

interface MapBounds {
    south: number
    west: number
    north: number
    east: number
}

/** Normalized bounds string for stable queryKey */
type NormalizedBounds = string

// ============================================
// HELPERS
// ============================================

/**
 * Normalize bounds to 2 decimal places (~1km precision)
 * This enables cache hits for small movements
 */
function normalizeBounds(bounds: MapBounds): NormalizedBounds {
    return `${bounds.north.toFixed(2)},${bounds.south.toFixed(2)},${bounds.east.toFixed(2)},${bounds.west.toFixed(2)}`
}

/**
 * Parse normalized bounds string back to object
 */
function parseNormalizedBounds(normalized: NormalizedBounds): MapBounds {
    const [north, south, east, west] = normalized.split(',').map(Number)
    return { north, south, east, west }
}

// ============================================
// STORE
// ============================================

interface MapState {
    // UI State
    highlightedReportId: string | null
    selectedReportId: string | null
    showSearchAreaButton: boolean

    // Visual bounds (updates on every movement)
    mapBounds: MapBounds | null

    // Search bounds (only updates on explicit search)
    searchBounds: NormalizedBounds | null
    lastSearchAt: number | null

    // Actions
    setHighlightedReportId: (id: string | null) => void
    setSelectedReportId: (id: string | null) => void
    setShowSearchAreaButton: (show: boolean) => void
    setMapBounds: (bounds: MapBounds) => void

    /**
     * ✅ FIX: Set search bounds from current map bounds
     * Returns true if search was triggered, false if idempotent skip
     */
    triggerSearchInBounds: () => { triggered: boolean; bounds: NormalizedBounds | null }

    /** Clear search bounds (go back to "all" mode) */
    clearSearchBounds: () => void
}

export const useMapStore = create<MapState>((set, get) => ({
    // Initial state
    highlightedReportId: null,
    selectedReportId: null,
    showSearchAreaButton: false,
    mapBounds: null,
    searchBounds: null,
    lastSearchAt: null,

    // Simple setters
    setHighlightedReportId: (id) => set({ highlightedReportId: id }),
    setSelectedReportId: (id) => set({ selectedReportId: id }),
    setShowSearchAreaButton: (show) => set({ showSearchAreaButton: show }),
    setMapBounds: (bounds) => set({ mapBounds: bounds }),

    // ✅ FIX: Trigger search with normalization and idempotence check
    triggerSearchInBounds: () => {
        const { mapBounds, searchBounds: currentSearchBounds } = get()

        if (!mapBounds) {
            console.log('[MapSearch] SEARCH_SKIPPED - No mapBounds available')
            return { triggered: false, bounds: null }
        }

        const normalized = normalizeBounds(mapBounds)

        // Idempotence check: skip if bounds haven't changed
        if (normalized === currentSearchBounds) {
            console.log('[MapSearch] SKIPPED_IDEMPOTENT - Same normalized bounds')
            return { triggered: false, bounds: normalized }
        }

        console.log('[MapSearch] SEARCH_TRIGGERED', normalized)

        set({
            searchBounds: normalized,
            lastSearchAt: Date.now(),
            showSearchAreaButton: false
        })

        return { triggered: true, bounds: normalized }
    },

    clearSearchBounds: () => {
        set({ searchBounds: null, lastSearchAt: null })
    }
}))

// Export helpers for external use
export { normalizeBounds, parseNormalizedBounds }
export type { MapBounds, NormalizedBounds }
