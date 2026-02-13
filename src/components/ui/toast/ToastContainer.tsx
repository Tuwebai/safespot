import { Toast } from './Toast'
import type { Toast as ToastType } from './types'
import { Z_INDEX } from '@/config/z-index'

interface ToastContainerProps {
  toasts: ToastType[]
  onRemove: (id: string) => void
}

/**
 * 🏛️ ToastContainer - Contenedor de notificaciones toast
 * 
 * Enterprise features:
 * - ✅ Posición fixed top-right
 * - ✅ Sistema z-index integrado (capa SYSTEM)
 * - ✅ Flex layout para múltiples toasts
 * - ✅ Pointer events manejados correctamente
 * 
 * Nota: Los toasts deben estar en capa SYSTEM (50-60) para
 * asegurar que se muestren por encima de modales.
 */
export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  if (toasts.length === 0) return null

  return (
    <div
      className="fixed top-4 right-4 flex flex-col gap-2 pointer-events-none"
      style={{ zIndex: Z_INDEX.TOAST }}
      aria-live="polite"
      aria-label="Notificaciones"
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <Toast toast={toast} onRemove={onRemove} />
        </div>
      ))}
    </div>
  )
}
