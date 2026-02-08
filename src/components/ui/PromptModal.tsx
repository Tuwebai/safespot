import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, MessageSquare } from 'lucide-react';

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

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-[#0f172a] border border-[#1e293b] w-full max-w-md rounded-xl shadow-2xl overflow-hidden">
                {/* Header */}
                <div className={`p-4 border-b border-[#1e293b] flex items-center gap-3 ${variant === 'danger' ? 'bg-red-500/10' : 'bg-blue-500/10'
                    }`}>
                    <div className={`p-2 rounded-lg ${variant === 'danger'
                            ? 'bg-red-500/20 text-red-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                        {variant === 'danger' ? <AlertTriangle size={20} /> : <MessageSquare size={20} />}
                    </div>
                    <div>
                        <h3 className="font-bold text-white leading-tight">{title}</h3>
                        {description && <p className="text-[11px] text-slate-400 mt-0.5">{description}</p>}
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
                        className="min-h-[120px] bg-[#020617] border-[#1e293b] text-white text-sm resize-none focus:ring-blue-500/20 focus:border-blue-500/50"
                        autoFocus
                    />
                    {error && (
                        <p className="text-red-400 text-xs flex items-center gap-1 animate-in slide-in-from-top-1">
                            <AlertTriangle size={12} />
                            {error}
                        </p>
                    )}
                    <div className="flex justify-between items-center px-1">
                        <p className="text-[10px] text-slate-500 italic">Mínimo {minLength} caracteres</p>
                        <p className={`text-xs font-mono ${value.trim().length >= minLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                            {value.trim().length}/{minLength}
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-[#1e293b] flex gap-3 bg-slate-900/50">
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        className="flex-1 h-10 border-[#1e293b] text-slate-400 hover:text-white"
                    >
                        {cancelText}
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={value.trim().length < minLength}
                        className={`flex-1 h-10 font-bold ${variant === 'danger'
                                ? 'bg-red-600 hover:bg-red-700 text-white'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            } disabled:opacity-30 disabled:cursor-not-allowed transition-all`}
                    >
                        {confirmText}
                    </Button>
                </div>
            </div>
        </div>,
        document.body
    );
}
