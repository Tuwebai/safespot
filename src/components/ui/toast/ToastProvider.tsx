import { useState, useCallback, useMemo, ReactNode } from 'react'
import { ToastContainer } from './ToastContainer'
import { ToastContext } from './ToastContext'
import type { Toast, ToastContextValue, ToastType, ToastAction } from './types'

interface ToastProviderProps {
  children: ReactNode
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id))
  }, [])

  const addToast = useCallback(
    (message: string, type: ToastType, duration?: number, action?: ToastAction) => {
      const now = Date.now()
      const id = `${type}-${now}-${Math.random().toString(36).substring(2, 9)}`

      setToasts((prev) => {
        // Prevenir duplicados: si ya existe un toast idéntico creado en los últimos 500ms, no agregarlo
        const isDuplicate = prev.some(
          (toast) =>
            toast.message === message &&
            toast.type === type &&
            now - toast.createdAt < 500
        )

        if (isDuplicate) {
          return prev
        }

        const newToast: Toast = {
          id,
          message,
          type,
          duration,
          createdAt: now,
          action,
        }

        return [...prev, newToast]
      })

      return id;
    },
    []
  )

  // 🏛️ ENTERPRISE: Toast with action for navigation
  const notify = useCallback(
    (options: { 
      message: string; 
      type?: ToastType; 
      duration?: number; 
      action?: ToastAction 
    }) => {
      return addToast(options.message, options.type || 'info', options.duration, options.action)
    },
    [addToast]
  )

  const success = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, 'success', duration)
    },
    [addToast]
  )

  const error = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, 'error', duration)
    },
    [addToast]
  )

  const info = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, 'info', duration)
    },
    [addToast]
  )

  const warning = useCallback(
    (message: string, duration?: number) => {
      return addToast(message, 'warning', duration)
    },
    [addToast]
  )

  // Memoize context value to prevent cascade re-renders
  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      addToast,
      removeToast,
      success,
      error,
      info,
      warning,
      notify,
    }),
    [toasts, addToast, removeToast, success, error, info, warning, notify]
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  )
}

