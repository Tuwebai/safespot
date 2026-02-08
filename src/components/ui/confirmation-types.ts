import { ReactNode } from 'react';

export interface ConfirmationOptions {
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'default';
}

export interface PromptOptions {
    title: string;
    description?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    minLength?: number;
    variant?: 'danger' | 'default';
}

export interface ConfirmationContextType {
    confirm: (options: ConfirmationOptions) => Promise<boolean>;
    prompt: (options: PromptOptions) => Promise<string | null>;
}

export interface ConfirmationProviderProps {
    children: ReactNode;
}
