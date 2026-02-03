import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    description: string;
    confirmText?: string;
    cancelText?: string;
    variant?: 'danger' | 'default';
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
    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm border border-gray-200 dark:border-gray-800 w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
                <div className="p-6 text-center">
                    <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg ${variant === 'danger'
                        ? 'bg-red-50 dark:bg-red-900/20 text-red-500 shadow-red-500/10'
                        : 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 shadow-indigo-500/10'
                        }`}>
                        <AlertTriangle className="w-8 h-8" strokeWidth={1.5} />
                    </div>

                    <h3 className="text-xl font-bold mb-3 text-foreground tracking-tight">{title}</h3>

                    <p className="text-muted-foreground text-sm mb-8 leading-relaxed px-4">
                        {description}
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                        <Button
                            variant="outline"
                            onClick={onClose}
                            className="w-full h-11 rounded-xl border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800"
                        >
                            {cancelText}
                        </Button>
                        <Button
                            variant={variant === 'danger' ? 'destructive' : 'default'}
                            onClick={() => {
                                onConfirm();
                                onClose();
                            }}
                            className={`w-full h-11 rounded-xl shadow-lg transition-all ${variant === 'danger'
                                ? 'shadow-red-500/20 hover:shadow-red-500/30'
                                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20 hover:shadow-indigo-500/30'
                                }`}
                        >
                            {confirmText}
                        </Button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
