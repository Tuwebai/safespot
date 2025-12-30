import { useContext } from 'react'
import { ToastContext } from './ToastContext'
import type { ToastContextValue } from './types'

export function useToast(): ToastContextValue {
    const context = useContext(ToastContext)
    if (context === undefined) {
        throw new Error('useToast debe usarse dentro de un ToastProvider')
    }
    return context
}
