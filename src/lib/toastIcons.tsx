import { Award, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react'

export type ToastIconType = 'success' | 'error' | 'warning' | 'info' | 'badge'

interface ToastIconProps {
    type: ToastIconType
    className?: string
}

export function ToastIcon({ type, className = '' }: ToastIconProps) {
    const baseClasses = 'w-5 h-5 flex-shrink-0'

    switch (type) {
        case 'success':
            return <CheckCircle className={`${baseClasses} text-neon-green ${className}`} />
        case 'error':
            return <XCircle className={`${baseClasses} text-red-500 ${className}`} />
        case 'warning':
            return <AlertTriangle className={`${baseClasses} text-yellow-500 ${className}`} />
        case 'info':
            return <Info className={`${baseClasses} text-blue-500 ${className}`} />
        case 'badge':
            return <Award className={`${baseClasses} text-amber-500 ${className}`} />
        default:
            return null
    }
}
