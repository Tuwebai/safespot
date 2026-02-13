import { useEffect, useCallback } from 'react';

/**
 * Hook para escuchar teclas del teclado.
 * 
 * 🏛️ SAFE SPOT ENTERPRISE
 * - Callback memoizado para evitar re-registros innecesarios
 * - Limpieza automática del event listener
 * - Type-safe
 * 
 * @param targetKey - Tecla a escuchar (ej: 'Escape', 'Enter')
 * @param callback - Función a ejecutar cuando se presiona la tecla
 * @param enabled - Si está activo (default: true)
 * 
 * @example
 * // Cerrar modal con Escape
 * useKeyPress('Escape', onClose, isOpen);
 * 
 * // Submit form con Enter
 * useKeyPress('Enter', handleSubmit, isFormValid);
 */
export function useKeyPress(
  targetKey: string,
  callback: () => void,
  enabled: boolean = true
): void {
  const handleKeyPress = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === targetKey) {
        event.preventDefault();
        callback();
      }
    },
    [targetKey, callback]
  );

  useEffect(() => {
    if (!enabled) return;

    document.addEventListener('keydown', handleKeyPress);
    
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [enabled, handleKeyPress]);
}
