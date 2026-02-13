import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X, User } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { useUpdateProfileMutation } from '@/hooks/mutations/useUpdateProfileMutation';
import { getOverlayZIndex } from '@/config/z-index';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useKeyPress } from '@/hooks/useKeyPress';
import { cn } from '@/lib/utils';

interface EditAliasModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAlias?: string | null;
    onSuccess: (newAlias: string) => void;
    isForced?: boolean; // New prop for mandatory mode
}

/**
 * 🏛️ EditAliasModal - Modal para editar alias público
 * 
 * Enterprise features:
 * - ✅ React Portal (escapa de stacking contexts)
 * - ✅ Sistema z-index integrado
 * - ✅ Bloqueo de scroll
 * - ✅ Cierre con Escape (solo si no es forzado)
 * - ✅ Restaura overflow al cerrar
 */
export function EditAliasModal({ isOpen, onClose, currentAlias, onSuccess, isForced = false }: EditAliasModalProps) {
    const toast = useToast();
    const updateProfile = useUpdateProfileMutation();
    const [alias, setAlias] = useState(currentAlias || '');
    const [error, setError] = useState<string | null>(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setAlias(currentAlias || '');
            setError(null);
        }
    }, [isOpen, currentAlias]);

    // Bloquear scroll cuando está abierto
    useScrollLock(isOpen);
    
    // Cerrar con Escape (solo si no es forzado)
    useKeyPress('Escape', onClose, isOpen && !isForced);

    if (!isOpen) return null;

    const validateAlias = (value: string) => {
        if (value.length < 3) return 'El alias debe tener al menos 3 caracteres.';
        if (value.length > 20) return 'El alias no puede superar los 20 caracteres.';
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Solo letras, números y guiones bajos.';
        return null;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const validationError = validateAlias(alias);
        if (validationError) {
            setError(validationError);
            return;
        }

        setError(null);

        updateProfile.mutate(
            { alias },
            {
                onSuccess: () => {
                    toast.success('Alias actualizado correctamente');
                    onSuccess(alias);
                    if (!isForced) onClose();
                },
                onError: (err: any) => {
                    const backendMessage = err.response?.data?.message || err.message;
                    setError(backendMessage || 'Error al guardar el alias. Intenta nuevamente.');
                }
            }
        );
    };

    // Obtener z-index del sistema
    const zIndexes = getOverlayZIndex('modal');

    const modalContent = (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
                style={{ zIndex: zIndexes.backdrop }}
                aria-hidden="true"
            />
            
            {/* Modal Container */}
            <div
                className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none"
                style={{ zIndex: zIndexes.content }}
                role="dialog"
                aria-modal="true"
            >
                <Card 
                    className={cn(
                        "w-full max-w-sm bg-dark-card border-dark-border shadow-xl relative",
                        "animate-in zoom-in-95 fade-in duration-200",
                        "pointer-events-auto"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    {!isForced && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                            onClick={onClose}
                            disabled={updateProfile.isPending}
                            aria-label="Cerrar"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    )}

                    <CardHeader>
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-neon-green/10 border border-neon-green/20 text-neon-green">
                                <User className="h-5 w-5" />
                            </div>
                            <div>
                                <CardTitle className="text-lg">Editar Alias Público</CardTitle>
                                <CardDescription>
                                    Un nombre único para identificarte en la comunidad.
                                </CardDescription>
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-foreground">
                                    Tu Alias
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                                    <Input
                                        value={alias}
                                        onChange={(e) => {
                                            setAlias(e.target.value);
                                            if (error) setError(null);
                                        }}
                                        className="pl-7 bg-dark-bg border-dark-border focus:border-neon-green/50"
                                        placeholder="UsuarioGenial"
                                        maxLength={20}
                                        disabled={updateProfile.isPending}
                                        autoFocus
                                    />
                                </div>
                                {error && <p className="text-xs text-red-500">{error}</p>}
                                <p className="text-xs text-muted-foreground">
                                    Visible para todos. Máx 20 caracteres.
                                </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                {!isForced && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={onClose}
                                        disabled={updateProfile.isPending}
                                    >
                                        Cancelar
                                    </Button>
                                )}
                                <Button
                                    type="submit"
                                    disabled={!alias.trim() || updateProfile.isPending}
                                    className="bg-neon-green text-black hover:bg-neon-green/90"
                                >
                                    {updateProfile.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        'Guardar Alias'
                                    )}
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </>
    );

    // Portal al body para escapar de stacking contexts
    return createPortal(modalContent, document.body);
}
