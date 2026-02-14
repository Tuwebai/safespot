import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, MessageSquare } from 'lucide-react';
import { getOverlayZIndex } from '@/config/z-index';

interface PromptModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (value: string) => void;
    title: string;
    description?: string;
    placeholder?: string;
    confirmText?: string;
    cancelText?: string;
    minLength?: number;
    variant?: 'danger' | 'default';
}

export function PromptModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    placeholder = 'Escribe aquí...',
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    minLength = 5,
    variant = 'default'
}: PromptModalProps) {
    const [value, setValue] = useState('');
    const [error, setError] = useState('');

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setValue('');
            setError('');
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        const trimmed = value.trim();
        if (trimmed.length < minLength) {
            setError(`Se requieren al menos ${minLength} caracteres.`);
            return;
        }
        onConfirm(trimmed);
    };

    const handleClose = () => {
        onClose();
    };

    const getHeaderStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-destructive/10';
            default:
                return 'bg-primary/10';
        }
    };

    const getIconStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-destructive/20 text-destructive';
            default:
                return 'bg-primary/20 text-primary';
        }
    };

    const getConfirmButtonStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
            default:
                return 'bg-primary hover:bg-primary/90 text-primary-foreground';
        }
    };

    const zIndexes = getOverlayZIndex('modal');

    return createPortal(
        <>
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200" 
                style={{ zIndex: zIndexes.backdrop }}
                onClick={handleClose}
            />
            <div 
                className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
                style={{ zIndex: zIndexes.content }}
            >
                <div 
                    className="bg-card border border-border w-full max-w-md rounded-xl shadow-2xl overflow-hidden pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                {/* Header */}
                <div className={`p-4 border-b border-border flex items-center gap-3 ${getHeaderStyles()}`}>
                    <div className={`p-2 rounded-lg ${getIconStyles()}`}>
                        {variant === 'danger' ? <AlertTriangle size={20} /> : <MessageSquare size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-card-foreground leading-tight">{title}</h3>
                        {description && <p className="text-[11px] text-muted-foreground mt-0.5">{description}</p>}
                    </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                    <Textarea
                        value={value}
                        onChange={(e) => {
                            setValue(e.target.value);
                            setError('');
                        }}
                        placeholder={placeholder}
                        className="min-h-[120px] bg-background border-border text-foreground text-sm resize-none focus:ring-ring focus:border-ring"
                        autoFocus
                    />
                    {error && (
                        <p className="text-destructive text-xs flex items-center gap-1 animate-in slide-in-from-top-1">
                            <AlertTriangle size={12} />
                            {error}
                        </p>
                    )}
                    <div className="flex justify-between items-center px-1">
                        <p className="text-[10px] text-muted-foreground italic">Mínimo {minLength} caracteres</p>
                        <p className={`text-xs font-mono ${value.trim().length >= minLength ? 'text-primary' : 'text-muted-foreground'}`}>
                            {value.trim().length}/{minLength}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-border flex gap-3 bg-muted/50">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        className="flex-1 h-10 border border-border text-muted-foreground hover:text-foreground hover:bg-accent"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={value.trim().length < minLength}
                        className={`flex-1 h-10 font-bold ${getConfirmButtonStyles()} disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>
        </>,
        document.body
    );
}
