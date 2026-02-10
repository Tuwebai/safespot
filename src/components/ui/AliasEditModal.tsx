import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, Info, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AliasEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (alias: string) => void;
    onRemove: () => void;
    initialAlias: string;
    targetName: string;
    hasExistingAlias: boolean;
}

const EDUCATION_KEY = 'safespot-alias-educated';

export function AliasEditModal({
    isOpen,
    onClose,
    onSave,
    onRemove,
    initialAlias,
    targetName,
    hasExistingAlias
}: AliasEditModalProps) {
    const [aliasInput, setAliasInput] = useState(initialAlias);
    const [showEducation, setShowEducation] = useState(() => {
        // Solo mostrar si nunca se educó al usuario
        return !localStorage.getItem(EDUCATION_KEY);
    });
    
    // Reset input when modal opens
    useEffect(() => {
        if (isOpen) {
            setAliasInput(initialAlias);
        }
    }, [isOpen, initialAlias]);

    const dismissEducation = () => {
        localStorage.setItem(EDUCATION_KEY, 'true');
        setShowEducation(false);
    };

    if (!isOpen) return null;

    const handleSave = () => {
        const trimmed = aliasInput.trim();
        if (trimmed) {
            onSave(trimmed);
        }
    };

    const handleRemove = () => {
        onRemove();
    };

    return createPortal(
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200" onMouseEnter={(e) => e.stopPropagation()}>
            <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 relative">
                <div className="p-6">
                    <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-6 shadow-lg bg-neon-green/10 text-neon-green">
                        <Tag className="w-8 h-8" strokeWidth={1.5} />
                    </div>

                    <h3 className="text-xl font-bold mb-2 text-card-foreground tracking-tight text-center">
                        Alias personal
                    </h3>

                    <p className="text-muted-foreground text-sm mb-4 leading-relaxed text-center">
                        Asigna un alias privado para <strong>{targetName}</strong>.
                    </p>

                    {/* 🎓 Mensaje educativo - solo primera vez */}
                    {showEducation && (
                        <div className="mb-4 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <div className="flex items-start gap-2">
                                <Info className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                                <div className="flex-1 text-xs text-blue-200/90 leading-relaxed">
                                    <p className="mb-1">
                                        <strong>¿Cómo funciona?</strong>
                                    </p>
                                    <ul className="space-y-0.5 list-disc list-inside">
                                        <li>Este alias es <strong>solo visible para vos</strong></li>
                                        <li>No cambia el nombre real del usuario</li>
                                        <li>Aparecerá con <span className="text-neon-green">#</span> en tu lista</li>
                                    </ul>
                                </div>
                                <button 
                                    onClick={dismissEducation}
                                    className="text-blue-400/60 hover:text-blue-400 transition-colors"
                                    title="No mostrar de nuevo"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-neon-green font-bold text-lg">#</span>
                        <Input
                            placeholder="Ej: VecinoJuan"
                            value={aliasInput}
                            onChange={(e) => setAliasInput(e.target.value)}
                            maxLength={40}
                            className="flex-1"
                            autoFocus
                        />
                    </div>
                    
                    <p className="text-xs text-muted-foreground mb-6">
                        Máximo 40 caracteres. Solo letras, números, espacios y guiones.
                    </p>

                    <div className="grid gap-3">
                        {hasExistingAlias && (
                            <Button
                                variant="destructive"
                                onClick={handleRemove}
                                className="w-full h-11 rounded-xl"
                            >
                                Eliminar alias
                            </Button>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                onClick={onClose}
                                className="w-full h-11 rounded-xl border-border hover:bg-accent hover:text-accent-foreground"
                            >
                                Cancelar
                            </Button>
                            <Button
                                onClick={handleSave}
                                disabled={aliasInput.trim().length === 0}
                                className="w-full h-11 rounded-xl shadow-lg transition-all bg-primary hover:bg-primary/90 text-primary-foreground"
                            >
                                Guardar
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
}
