import { divIcon } from 'leaflet'
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
        case 'Robo de Bicicleta': return 'bg-red-500'
        case 'Robo de Vehículo': return 'bg-orange-500'
        case 'Robo de Objetos Personales': return 'bg-purple-500'
        case 'Pérdida de Objetos': return 'bg-blue-500'
        case 'Encontrado': return 'bg-green-500'
        default: return 'bg-gray-500'
    }
}

export const getMarkerIcon = ({ category, status, isHighlighted }: { category: string, status: string, isHighlighted?: boolean }) => {
    const IconComponent = getCategoryIcon(category)
    const bgColor = getCategoryColor(category)
    const isResolved = status === 'resuelto' || status === 'cerrado'

    // Highlight styles
    const scale = isHighlighted ? 'scale-125 z-[1000]' : 'scale-100'
    const border = isHighlighted ? 'border-[3px] border-white ring-2 ring-neon-green/50' : 'border-2 border-white'

    const iconHtml = renderToStaticMarkup(
        <div className={`relative flex items-center justify-center w-8 h-8 rounded-full shadow-lg transition-all duration-300 ${bgColor} ${border} ${scale} ${isResolved ? 'opacity-60 grayscale' : ''}`}>
            <IconComponent className="w-4 h-4 text-white" />
            {status === 'en_proceso' && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-pulse" />
            )}
        </div>
    )

    return divIcon({
        html: iconHtml,
        className: 'bg-transparent',
        iconSize: isHighlighted ? [40, 40] : [32, 32],
        iconAnchor: isHighlighted ? [20, 40] : [16, 32],
        popupAnchor: [0, -32]
    })
}
