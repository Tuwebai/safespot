import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { ToastContainer } from './ToastContainer'
import type { Toast, ToastContextValue, ToastType } from './types'

const ToastContext = createContext<ToastContextValue | undefined>(undefined)

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType, duration?: number) => {
      // Prevenir duplicados: si ya existe un toast idéntico creado en los últimos 500ms, no agregarlo
      const now = Date.now()
      
      setToasts((prev) => {
        const isDuplicate = prev.some(
          (toast) =>
            toast.message === message &&
            toast.type === type &&
            now - toast.createdAt < 500
        )

        if (isDuplicate) {
          return prev
        }

        const id = `${type}-${now}-${Math.random().toString(36).substring(2, 9)}`
        const newToast: Toast = {
          id,
          message,
          type,
          duration,
          createdAt: now,
        }

        return [...prev, newToast]
      })
    },
    []
  )

  const success = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'success', duration)
    },
    [addToast]
  )

  const error = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'error', duration)
    },
    [addToast]
  )

  const info = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'info', duration)
    },
    [addToast]
  )

  const warning = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'warning', duration)
    },
    [addToast]
  )

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    info,
    warning,
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (context === undefined) {
    throw new Error('useToast debe usarse dentro de un ToastProvider')
  }
  return context
}

