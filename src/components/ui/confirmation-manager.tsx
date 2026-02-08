import { useState, useCallback } from 'react';
import { ConfirmationModal } from './ConfirmationModal';
import { PromptModal } from './PromptModal';
import { ConfirmationContext } from './confirmation-context';
import { ConfirmationOptions, PromptOptions, ConfirmationProviderProps } from './confirmation-types';

export function ConfirmationProvider({ children }: ConfirmationProviderProps) {
    // Confirmation State
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);
    const [confirmOptions, setConfirmOptions] = useState<ConfirmationOptions>({
        title: '',
        description: '',
        variant: 'default',
    });
    const [confirmResolver, setConfirmResolver] = useState<((value: boolean) => void) | null>(null);

    // Prompt State
    const [isPromptOpen, setIsPromptOpen] = useState(false);
    const [promptOptions, setPromptOptions] = useState<PromptOptions>({
        title: '',
        variant: 'default',
    });
    const [promptResolver, setPromptResolver] = useState<((value: string | null) => void) | null>(null);

    const confirm = useCallback((opts: ConfirmationOptions) => {
        setConfirmOptions(opts);
        setIsConfirmOpen(true);
        return new Promise<boolean>((resolve) => {
            setConfirmResolver(() => resolve);
        });
    }, []);

    const prompt = useCallback((opts: PromptOptions) => {
        setPromptOptions(opts);
        setIsPromptOpen(true);
        return new Promise<string | null>((resolve) => {
            setPromptResolver(() => resolve);
        });
    }, []);

    const handleConfirmOk = useCallback(() => {
        if (confirmResolver) confirmResolver(true);
        setIsConfirmOpen(false);
        setConfirmResolver(null);
    }, [confirmResolver]);

    const handleConfirmCancel = useCallback(() => {
        if (confirmResolver) confirmResolver(false);
        setIsConfirmOpen(false);
        setConfirmResolver(null);
    }, [confirmResolver]);

    const handlePromptOk = useCallback((value: string) => {
        if (promptResolver) promptResolver(value);
        setIsPromptOpen(false);
        setPromptResolver(null);
    }, [promptResolver]);

    const handlePromptCancel = useCallback(() => {
        if (promptResolver) promptResolver(null);
        setIsPromptOpen(false);
        setPromptResolver(null);
    }, [promptResolver]);

    return (
        <ConfirmationContext.Provider value={{ confirm, prompt }}>
            {children}
            <ConfirmationModal
                isOpen={isConfirmOpen}
                onClose={handleConfirmCancel}
                onConfirm={handleConfirmOk}
                {...confirmOptions}
            />
            <PromptModal
                isOpen={isPromptOpen}
                onClose={handlePromptCancel}
                onConfirm={handlePromptOk}
                {...promptOptions}
            />
        </ConfirmationContext.Provider>
    );
}

// Nota: useConfirm se movió a ./useConfirm.ts para cumplir con las reglas de Fast Refresh de Vite.
// Para mantener la compatibilidad hacia atrás sin disparar la advertencia, re-exportamos solo como tipo/alias si fuera necesario,
// pero lo ideal es actualizar las importaciones críticas.
