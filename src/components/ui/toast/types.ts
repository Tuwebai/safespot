export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastAction {
  label: string
  onClick: () => void
}

export interface Toast {
  id: string
  message: string
  type: ToastType
  duration?: number
  createdAt: number
  action?: ToastAction // 🏛️ ENTERPRISE: Optional action button for navigation
}

export interface ToastContextValue {
  toasts: Toast[]
  addToast: (message: string, type: ToastType, duration?: number, action?: ToastAction) => string
  removeToast: (id: string) => void
  success: (message: string, duration?: number) => string
  error: (message: string, duration?: number) => string
  info: (message: string, duration?: number) => string
  warning: (message: string, duration?: number) => string
  // 🏛️ ENTERPRISE: Advanced toast with action support
  notify: (options: { 
    message: string; 
    type?: ToastType; 
    duration?: number; 
    action?: ToastAction 
  }) => string
}

