import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { ConfirmationModal } from './ConfirmationModal';

interface ConfirmationOptions {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'default';
}

interface ConfirmationContextType {
    confirm: (options: ConfirmationOptions) => Promise<boolean>;
}

const ConfirmationContext = createContext<ConfirmationContextType | undefined>(undefined);

export function ConfirmationProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<ConfirmationOptions>({
        title: '',
        description: '',
        variant: 'default',
    });
    const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmationOptions) => {
        setOptions(opts);
        setIsOpen(true);
        return new Promise<boolean>((resolve) => {
            setResolver(() => resolve);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        if (resolver) resolver(true);
        setIsOpen(false);
        setResolver(null); // Clean up
    }, [resolver]);

    const handleCancel = useCallback(() => {
        if (resolver) resolver(false);
        setIsOpen(false);
        setResolver(null); // Clean up
    }, [resolver]);

    return (
        <ConfirmationContext.Provider value={{ confirm }}>
            {children}
            {isOpen && (
                <ConfirmationModal
                    isOpen={isOpen}
                    onClose={handleCancel}
                    onConfirm={handleConfirm}
                    title={options.title}
                    description={options.description}
                    confirmText={options.confirmText}
                    cancelText={options.cancelText}
                    variant={options.variant}
                />
            )}
        </ConfirmationContext.Provider>
    );
}

export function useConfirm() {
    const context = useContext(ConfirmationContext);
    if (!context) {
        // FALLBACK SEGURO: Previene crash en producción
        console.error('CRITICAL: useConfirm called outside ConfirmationProvider');

        // En desarrollo, lanzamos error para detectar el bug
        if (import.meta.env.DEV) {
            throw new Error('useConfirm must be used within a ConfirmationProvider');
        }

        // En producción, devolvemos una implementación "dummy" segura (o window.confirm si es crítico)
        return {
            confirm: async (options: ConfirmationOptions) => {
                console.warn('Using native fallback for confirmation due to missing provider');
                return window.confirm(`${options.title}\n\n${options.description}`);
            }
        };
    }
    return context;
}
