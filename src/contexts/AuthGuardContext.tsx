import { createContext, useContext, useState, useCallback, useRef, ReactNode } from 'react';

/**
 * Auth Guard Context
 * 
 * ✅ ENTERPRISE FIX: Modal global controlado por Provider
 * ✅ UNA SOLA instancia de modal en toda la app
 * ✅ Estado centralizado, mutations limpias
 * 🔴 SECURITY FIX: Race condition eliminated with idempotent guards
 */

interface AuthGuardContextType {
    isModalOpen: boolean;
    openModal: () => void;
    closeModal: () => void;
}

const AuthGuardContext = createContext<AuthGuardContextType | undefined>(undefined);

export function AuthGuardProvider({ children }: { children: ReactNode }) {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // 🔴 CRITICAL FIX: Idempotent guard using ref to prevent race conditions
    // This ensures that multiple rapid calls to openModal() don't cause flickering
    // or redundant setState calls, which can lead to inconsistent UI state.
    const isModalOpenRef = useRef(false);

    const openModal = useCallback(() => {
        // 🔴 Idempotent Guard: If already open, do nothing
        if (isModalOpenRef.current) return;

        isModalOpenRef.current = true;
        setIsModalOpen(true);
    }, []);

    const closeModal = useCallback(() => {
        // 🔴 Idempotent Guard: If already closed, do nothing
        if (!isModalOpenRef.current) return;

        isModalOpenRef.current = false;
        setIsModalOpen(false);
    }, []);

    return (
        <AuthGuardContext.Provider value={{
            isModalOpen,
            openModal,
            closeModal
        }}>
            {children}
        </AuthGuardContext.Provider>
    );
}

export function useAuthGuardContext() {
    const context = useContext(AuthGuardContext);
    if (!context) {
        throw new Error('useAuthGuardContext must be used within AuthGuardProvider');
    }
    return context;
}
