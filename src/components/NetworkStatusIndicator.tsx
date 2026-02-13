import { WifiOff, Database } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'
import { Z_INDEX } from '@/config/z-index'

export function NetworkStatusIndicator() {
    const isOnline = useNetworkStatus()

    if (isOnline) return null

    return (
        <div 
            className="fixed top-0 left-0 right-0 bg-yellow-600 text-white px-4 py-2 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top"
            style={{ zIndex: Z_INDEX.NETWORK_STATUS }}
        >
            <WifiOff className="h-4 w-4" />
            <span>Sin conexión</span>
            <span className="text-yellow-200">•</span>
            <Database className="h-4 w-4" />
            <span className="text-yellow-100">Mostrando datos guardados</span>
        </div>
    )
}
