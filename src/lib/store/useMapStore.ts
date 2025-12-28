import { create } from 'zustand'

interface MapState {
    highlightedReportId: string | null
    selectedReportId: string | null
    showSearchAreaButton: boolean
    mapBounds: { south: number; west: number; north: number; east: number } | null

    setHighlightedReportId: (id: string | null) => void
    setSelectedReportId: (id: string | null) => void
    setShowSearchAreaButton: (show: boolean) => void
    setMapBounds: (bounds: { south: number; west: number; north: number; east: number }) => void
}

export const useMapStore = create<MapState>((set) => ({
    highlightedReportId: null,
    selectedReportId: null,
    showSearchAreaButton: false,
    mapBounds: null,

    setHighlightedReportId: (id) => set({ highlightedReportId: id }),
    setSelectedReportId: (id) => set({ selectedReportId: id }),
    setShowSearchAreaButton: (show) => set({ showSearchAreaButton: show }),
    setMapBounds: (bounds) => set({ mapBounds: bounds }),
}))
