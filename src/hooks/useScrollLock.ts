import { useEffect, useRef } from 'react';

/**
 * Hook para bloquear/desbloquear scroll del body o un elemento específico.
 * 
 * 🏛️ SAFE SPOT ENTERPRISE
 * - Preserva el padding-right para compensar scrollbar
 * - Restaura valores originales al desmontar
 * - Type-safe y memoizado
 * 
 * @param isLocked - Si true, bloquea el scroll
 * @param targetRef - Opcional: elemento específico a bloquear (default: document.body)
 * 
 * @example
 * // Bloquear scroll del body
 * useScrollLock(isModalOpen);
 * 
 * // Bloquear scroll de un contenedor específico
 * const containerRef = useRef<HTMLDivElement>(null);
 * useScrollLock(isOpen, containerRef);
 */
export function useScrollLock(
  isLocked: boolean,
  targetRef?: React.RefObject<HTMLElement>
): void {
  // Guardar valores originales para restaurar
  const originalStyles = useRef<{
    overflow: string;
    paddingRight: string;
  } | null>(null);

  useEffect(() => {
    if (!isLocked) return;

    const target = targetRef?.current || document.body;
    
    // Guardar valores originales solo una vez
    if (!originalStyles.current) {
      originalStyles.current = {
        overflow: target.style.overflow,
        paddingRight: target.style.paddingRight,
      };
    }

    // Calcular ancho de scrollbar para evitar layout shift
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    
    // Aplicar bloqueo
    target.style.overflow = 'hidden';
    
    // Solo compensar scrollbar si es el body y hay scrollbar visible
    if (target === document.body && scrollbarWidth > 0) {
      target.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Cleanup: restaurar valores originales
    return () => {
      if (originalStyles.current) {
        target.style.overflow = originalStyles.current.overflow;
        target.style.paddingRight = originalStyles.current.paddingRight;
      }
    };
  }, [isLocked, targetRef]);
}
