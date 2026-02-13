import { createPortal } from 'react-dom';
import { ReactNode } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getOverlayZIndex } from '@/config/z-index';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useKeyPress } from '@/hooks/useKeyPress';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface BaseModalProps {
  /** Controla visibilidad del modal */
  isOpen: boolean;
  /** Callback al cerrar el modal */
  onClose: () => void;
  /** Contenido del modal */
  children: ReactNode;
  /** Clases adicionales para el contenedor */
  className?: string;
  /** 
   * Capa del sistema de z-index.
   * - 'modal': Modales estándar (default)
   * - 'confirmation': Diálogos de confirmación importantes
   * - 'emergency': Errores críticos, bloqueantes
   */
  layer?: 'modal' | 'confirmation' | 'emergency';
  /** Si cierra al hacer click en el backdrop (default: true) */
  closeOnBackdrop?: boolean;
  /** Si cierra con tecla Escape (default: true) */
  closeOnEscape?: boolean;
  /** Si bloquea scroll del body (default: true) */
  blockScroll?: boolean;
  /** Si muestra animaciones (default: true) */
  animated?: boolean;
  /** 
   * Tamaño del modal.
   * - 'sm': 400px max-width
   * - 'md': 500px max-width (default)
   * - 'lg': 600px max-width
   * - 'xl': 800px max-width
   * - 'full': 100% - 2rem
   */
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  /** 
   * Posición vertical.
   * - 'center': Centrado (default)
   * - 'bottom': Abajo (mobile-style)
   */
  position?: 'center' | 'bottom';
}

const sizeClasses = {
  sm: 'max-w-[400px]',
  md: 'max-w-[500px]',
  lg: 'max-w-[600px]',
  xl: 'max-w-[800px]',
  full: 'max-w-[calc(100%-2rem)]',
};

/**
 * 🏛️ BASE MODAL - Componente base para todos los modales de Safe Spot
 * 
 * Características enterprise:
 * - ✅ Siempre usa React Portal (document.body)
 * - ✅ Sistema de z-index integrado
 * - ✅ Bloqueo de scroll automático
 * - ✅ Cierre con Escape
 * - ✅ Backdrop con blur
 * - ✅ Animaciones suaves
 * - ✅ Type-safe y accesible
 * 
 * @example
 * <BaseModal
 *   isOpen={isOpen}
 *   onClose={onClose}
 *   layer="modal"
 *   size="md"
 * >
 *   <h2>Título</h2>
 *   <p>Contenido...</p>
 * </BaseModal>
 */
export function BaseModal({
  isOpen,
  onClose,
  children,
  className,
  layer = 'modal',
  closeOnBackdrop = true,
  closeOnEscape = true,
  blockScroll = true,
  animated = true,
  size = 'md',
  position = 'center',
}: BaseModalProps) {
  // Bloquear scroll cuando está abierto
  useScrollLock(isOpen && blockScroll);
  
  // Cerrar con Escape
  useKeyPress('Escape', onClose, isOpen && closeOnEscape);

  // Obtener z-index según la capa
  const zIndexes = getOverlayZIndex(layer);

  // Configuración de animaciones
  const backdropVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
  };

  const contentVariants = {
    hidden: position === 'bottom' 
      ? { opacity: 0, y: '100%' }
      : { opacity: 0, scale: 0.95, y: 20 },
    visible: position === 'bottom'
      ? { opacity: 1, y: 0 }
      : { opacity: 1, scale: 1, y: 0 },
  };

  const transition = {
    duration: 0.2,
    ease: [0.4, 0, 0.2, 1] as const,
  };

  if (!isOpen) return null;

  const modal = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            variants={animated ? backdropVariants : undefined}
            initial={animated ? 'hidden' : undefined}
            animate={animated ? 'visible' : undefined}
            exit={animated ? 'hidden' : undefined}
            transition={transition}
            className={cn(
              "fixed inset-0 bg-black/60 backdrop-blur-sm",
              closeOnBackdrop && "cursor-pointer"
            )}
            style={{ zIndex: zIndexes.backdrop }}
            onClick={closeOnBackdrop ? onClose : undefined}
            aria-hidden="true"
          />
          
          {/* Content Container */}
          <div
            className={cn(
              "fixed inset-0 flex p-4 pointer-events-none",
              position === 'center' && "items-center justify-center",
              position === 'bottom' && "items-end justify-center sm:items-center"
            )}
            style={{ zIndex: zIndexes.content }}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              variants={animated ? contentVariants : undefined}
              initial={animated ? 'hidden' : undefined}
              animate={animated ? 'visible' : undefined}
              exit={animated ? 'hidden' : undefined}
              transition={transition}
              className={cn(
                "pointer-events-auto w-full",
                "bg-card border border-border rounded-2xl shadow-2xl",
                "overflow-hidden",
                sizeClasses[size],
                className
              )}
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(modal, document.body);
}

/**
 * Header pre-diseñado para BaseModal
 */
interface ModalHeaderProps {
  title: string;
  description?: string;
  onClose?: () => void;
  showCloseButton?: boolean;
}

export function ModalHeader({ 
  title, 
  description, 
  onClose, 
  showCloseButton = true 
}: ModalHeaderProps) {
  return (
    <div className="flex items-start justify-between p-6 border-b border-border">
      <div className="flex-1 pr-4">
        <h2 className="text-lg font-semibold text-foreground">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </div>
      {showCloseButton && onClose && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="shrink-0 rounded-full h-8 w-8"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

/**
 * Footer pre-diseñado para BaseModal con acciones
 */
interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

export function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div className={cn(
      "flex items-center justify-end gap-3 p-6 border-t border-border bg-muted/30",
      className
    )}>
      {children}
    </div>
  );
}

/**
 * Body pre-diseñado para BaseModal con scroll
 */
interface ModalBodyProps {
  children: ReactNode;
  className?: string;
  scrollable?: boolean;
}

export function ModalBody({ children, className, scrollable = false }: ModalBodyProps) {
  return (
    <div className={cn(
      "p-6",
      scrollable && "max-h-[60vh] overflow-y-auto",
      className
    )}>
      {children}
    </div>
  );
}
