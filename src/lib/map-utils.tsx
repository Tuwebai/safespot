import L from 'leaflet'
import { renderToStaticMarkup } from 'react-dom/server'
import { Bike, Car, Package, Search, HelpCircle, MapPin } from 'lucide-react'

export const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'Robo de Bicicleta': return Bike
        case 'Robo de Vehículo': return Car
        case 'Robo de Objetos Personales': return Package
        case 'Pérdida de Objetos': return Search
        case 'Encontrado': return MapPin
        default: return HelpCircle
    }
}

export const getCategoryColor = (category: string) => {
    switch (category) {
        case 'Robo de Bicicleta': return '#ef4444' // red-500
        case 'Robo de Vehículo': return '#f97316' // orange-500
        case 'Robo de Objetos Personales': return '#a855f7' // purple-500
        case 'Pérdida de Objetos': return '#3b82f6' // blue-500
        case 'Encontrado': return '#22c55e' // green-500
        default: return '#6b7280' // gray-500
    }
}

// Icon cache to avoid redundant generations
const iconCache: Record<string, L.Icon> = {}

export const getMarkerIcon = ({ category, status, isHighlighted }: { category: string, status: string, isHighlighted?: boolean }) => {
    const cacheKey = `${category}-${status}-${isHighlighted ? 'h' : 'n'}`
    if (iconCache[cacheKey]) return iconCache[cacheKey]

    const IconComponent = getCategoryIcon(category)
    const color = getCategoryColor(category)
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
