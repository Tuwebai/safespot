import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, X, User } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { usersApi } from '@/lib/api';

interface EditAliasModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentAlias?: string | null;
    onSuccess: (newAlias: string) => void;
    isForced?: boolean; // New prop for mandatory mode
}

export function EditAliasModal({ isOpen, onClose, currentAlias, onSuccess, isForced = false }: EditAliasModalProps) {
    const toast = useToast();
    const [alias, setAlias] = useState(currentAlias || '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setAlias(currentAlias || '');
            setError(null);
        }
    }, [isOpen, currentAlias]);

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

        setSubmitting(true);
        setError(null);

        try {
            await usersApi.updateProfile({ alias });
            toast.success('Alias actualizado correctamente');
            onSuccess(alias);
            if (!isForced) onClose(); // Only close if not forced (parent might handle closing)
        } catch (err: any) {
            console.error(err);
            // Mostrar mensaje específico del backend si existe (ej: "Este alias ya está en uso")
            const backendMessage = err.response?.data?.message || err.message;
            setError(backendMessage || 'Error al guardar el alias. Intenta nuevamente.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
        >
            <Card className="w-full max-w-sm bg-dark-card border-dark-border shadow-xl relative animate-in zoom-in-95 duration-200">
                {!isForced && (
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                        onClick={onClose}
                        disabled={submitting}
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
                                    disabled={submitting}
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
                                    disabled={submitting}
                                >
                                    Cancelar
                                </Button>
                            )}
                            <Button
                                type="submit"
                                disabled={!alias.trim() || submitting}
                                className="bg-neon-green text-black hover:bg-neon-green/90"
                            >
                                {submitting ? (
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
        </div >
    );
}
