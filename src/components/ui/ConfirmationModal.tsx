import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';
import { getOverlayZIndex } from '@/config/z-index';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useKeyPress } from '@/hooks/useKeyPress';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'default' | 'warning';
}

export function ConfirmationModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    description,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    variant = 'default'
}: ConfirmationModalProps) {
    // 🏛️ ENTERPRISE: Bloquear scroll y Escape
    useScrollLock(isOpen);
    useKeyPress('Escape', onClose, isOpen);
    
    if (!isOpen) return null;
    
    const zIndexes = getOverlayZIndex('confirmation');

    const getIconStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-destructive/10 text-destructive';
            case 'warning':
                return 'bg-yellow-500/10 text-yellow-500';
            default:
                return 'bg-primary/10 text-primary';
        }
    };

    const getConfirmButtonStyles = () => {
        switch (variant) {
            case 'danger':
                return 'bg-destructive hover:bg-destructive/90 text-destructive-foreground';
            case 'warning':
                return 'bg-yellow-500 hover:bg-yellow-600 text-black';
            default:
                return 'bg-primary hover:bg-primary/90 text-primary-foreground';
        }
    };

    return createPortal(
        <>
            <div 
                className="fixed inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
                style={{ zIndex: zIndexes.backdrop }}
                onClick={onClose}
                aria-hidden="true"
            />
            <div 
                className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
                style={{ zIndex: zIndexes.content }}
                role="dialog"
                aria-modal="true"
            >
                <div 
                    className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-6 text-center">
                        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg ${getIconStyles()}`}>
                            <AlertTriangle className="w-8 h-8" strokeWidth={1.5} />
                        </div>

                        <h3 className="text-xl font-bold mb-3 text-card-foreground tracking-tight">{title}</h3>

                        <p className="text-muted-foreground text-sm mb-8 leading-relaxed px-4">
                            {description}
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="w-full h-11 rounded-xl border-border hover:bg-accent hover:text-accent-foreground"
                            >
                                {cancelText}
                            </Button>
                            <Button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`w-full h-11 rounded-xl shadow-lg transition-all ${getConfirmButtonStyles()}`}
                            >
                                {confirmText}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
