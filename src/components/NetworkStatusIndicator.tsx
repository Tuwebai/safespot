import { WifiOff } from 'lucide-react'
import { useNetworkStatus } from '@/hooks/useNetworkStatus'

export function NetworkStatusIndicator() {
    const isOnline = useNetworkStatus()

    if (isOnline) return null

    return (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-red-600 text-white px-4 py-1 text-center text-sm font-medium flex items-center justify-center gap-2 shadow-md animate-in slide-in-from-top">
            <WifiOff className="h-4 w-4" />
            <span>Sin conexión a internet. Verificá tu red.</span>
        </div>
    )
}
