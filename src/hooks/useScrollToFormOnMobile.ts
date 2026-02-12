import { useEffect, useRef, RefObject } from 'react';

interface UseScrollToFormOnMobileOptions {
    /**
     * Condición para activar el scroll (ej: isOpen, hasErrors)
     */
    enabled: boolean;
    /**
     * Delay en ms antes de hacer scroll (útil para esperar animaciones)
     */
    delay?: number;
    /**
     * Breakpoint en px para considerar mobile (default: 640)
     */
    mobileBreakpoint?: number;
    /**
     * Comportamiento del scroll (default: 'smooth')
     */
    behavior?: ScrollBehavior;
    /**
     * Bloque de alineación (default: 'start')
     */
    block?: ScrollLogicalPosition;
}

/**
 * Hook para hacer scroll a un formulario cuando se abre en mobile.
 * Útil para modales y formularios largos donde el teclado puede ocultar los inputs.
 */
export function useScrollToFormOnMobile<T extends HTMLElement>(
    options: UseScrollToFormOnMobileOptions
): RefObject<T> {
    const { 
        enabled, 
        delay = 100, 
        mobileBreakpoint = 640,
        behavior = 'smooth',
        block = 'start'
    } = options;
    
    const ref = useRef<T>(null);

    useEffect(() => {
        if (!enabled) return;
        
        // Solo ejecutar en mobile
        const isMobile = typeof window !== 'undefined' && window.innerWidth < mobileBreakpoint;
        if (!isMobile) return;

        const timer = setTimeout(() => {
            if (ref.current) {
                ref.current.scrollIntoView({ 
                    behavior, 
                    block,
                    inline: 'nearest'
                });
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [enabled, delay, mobileBreakpoint, behavior, block]);

    return ref;
}

/**
 * Hook simplificado para hacer scroll a un elemento específico.
 * No depende de breakpoint, simplemente scrollea cuando enabled cambia a true.
 */
export function useScrollIntoView<T extends HTMLElement>(
    enabled: boolean,
    options: {
        delay?: number;
        behavior?: ScrollBehavior;
        block?: ScrollLogicalPosition;
    } = {}
): RefObject<T> {
    const { delay = 100, behavior = 'smooth', block = 'center' } = options;
    const ref = useRef<T>(null);

    useEffect(() => {
        if (!enabled) return;

        const timer = setTimeout(() => {
            if (ref.current) {
                ref.current.scrollIntoView({ 
                    behavior, 
                    block,
                    inline: 'nearest'
                });
            }
        }, delay);

        return () => clearTimeout(timer);
    }, [enabled, delay, behavior, block]);

    return ref;
}
