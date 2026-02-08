import { useContext } from 'react';
import { ConfirmationContext } from './confirmation-context';
import { ConfirmationOptions, PromptOptions } from './confirmation-types';

export function useConfirm() {
    const context = useContext(ConfirmationContext);
    if (!context) {
        console.error('CRITICAL: useConfirm called outside ConfirmationProvider');
        if (import.meta.env.DEV) {
            throw new Error('useConfirm must be used within a ConfirmationProvider');
        }
        return {
            confirm: async (options: ConfirmationOptions) => {
                return window.confirm(`${options.title}\n\n${options.description}`);
            },
            prompt: async (options: PromptOptions) => {
                return window.prompt(`${options.title}${options.description ? '\n' + options.description : ''}`);
            }
        };
    }
    return context;
}
