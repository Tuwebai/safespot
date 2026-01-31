import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { resolveCategoryIcon } from '@/lib/icons/category-icons'

// Icon cache to avoid redundant generations
const iconCache: Record<string, L.Icon> = {}

export const getMarkerIcon = ({ category, status, isHighlighted }: { category: string, status: string, isHighlighted?: boolean }) => {
    // 1. Resolve Config from Registry (SSOT)
    // This eliminates the switch statement and ensures we always look up against official categories
    const { icon: IconComponent, color } = resolveCategoryIcon(category)

    const cacheKey = `${category}-${status}-${isHighlighted ? 'h' : 'n'}`
    if (iconCache[cacheKey]) return iconCache[cacheKey]

    const isResolved = status === 'resuelto' || status === 'cerrado'
    const isInProgress = status === 'en_proceso'

    // Generate Lucide SVG markup
    const innerIconHtml = renderToStaticMarkup(<IconComponent size={16} color="white" />)

    // Build optimized SVG container
    const size = isHighlighted ? 40 : 32
    const center = size / 2
    const radius = isHighlighted ? 18 : 14
    const iconOffset = center - 8 // Center 16px icon

    const svg = `
        <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur in="SourceAlpha" stdDeviation="2" />
                    <feOffset dx="0" dy="1" result="offsetblur" />
                    <feComponentTransfer>
                        <feFuncA type="linear" slope="0.3" />
                    </feComponentTransfer>
                    <feMerge>
                        <feMergeNode />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            <g filter="${isHighlighted ? 'url(#glow)' : 'none'}" opacity="${isResolved ? '0.6' : '1'}">
                <circle cx="${center}" cy="${center}" r="${radius}" fill="${color}" stroke="white" stroke-width="2" />
                ${isHighlighted ? `<circle cx="${center}" cy="${center}" r="${radius + 2}" stroke="#39FF14" stroke-width="2" stroke-opacity="0.5" />` : ''}
                <g transform="translate(${iconOffset}, ${iconOffset})">
                    ${innerIconHtml}
                </g>
                ${isInProgress ? `<circle cx="${center + 10}" cy="${center - 10}" r="4" fill="#3b82f6" stroke="white" stroke-width="1.5" />` : ''}
            </g>
        </svg>
    `.trim()

    const icon = L.icon({
        iconUrl: `data:image/svg+xml;base64,${btoa(svg)}`,
        iconSize: [size, size],
        iconAnchor: [center, size], // Bottom point anchor
        popupAnchor: [0, -size],
        className: 'marker-svg-optimized'
    })

    iconCache[cacheKey] = icon
    return icon
}

/**
 * Enterprise Haversine Distance Calculation
 * Returns distance in meters between two points
 * @param lat1 Latitude of point 1
 * @param lon1 Longitude of point 1
 * @param lat2 Latitude of point 2
 * @param lon2 Longitude of point 2
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3 // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
}

/**
 * Checks if a coordinate is within a bounding box
 */
export function isPointInBounds(lat: number, lng: number, bounds: { north: number, south: number, east: number, west: number }): boolean {
    return (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
    )
}

/**
 * Checks if a coordinate is within a radius of another coordinate
 */
export function isPointInRadius(lat: number, lng: number, centerLat: number, centerLng: number, radiusMeters: number): boolean {
    const distance = calculateDistance(lat, centerLat, lng, centerLng)
    return distance <= radiusMeters
}

