import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Eye, MapPin, AlertTriangle, Loader2, X } from 'lucide-react';
import { SightingType } from './SightingActions';

interface SightingFormDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: { zone: string; content: string; type: SightingType }) => Promise<void>;
    type: SightingType | null;
    submitting: boolean;
}

const UI_CONFIG = {
    seen: {
        title: 'Reportar Avistamiento',
        icon: Eye,
        color: 'text-neon-green',
        description: '¿Dónde lo viste? Danos detalles precisos.',
        button: 'Enviar Avistamiento'
    },
    likely: {
        title: 'Reportar Zona',
        icon: MapPin,
        color: 'text-blue-500',
        description: '¿Por dónde creés haberlo visto?',
        button: 'Enviar Zona'
    },
    possible: {
        title: 'Reportar Pista',
        icon: AlertTriangle,
        color: 'text-yellow-500',
        description: '¿Qué info útil tenés para compartir?',
        button: 'Enviar Pista'
    }
};

export function SightingFormDialog({ isOpen, onClose, onSubmit, type, submitting }: SightingFormDialogProps) {
    const [zone, setZone] = useState('');
    const [content, setContent] = useState('');

    if (!isOpen || !type) return null;

    const config = UI_CONFIG[type];
    const Icon = config.icon;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        await onSubmit({ zone, content, type });
        // Reset handled by parent or onClose effect if needed, but safe to clear here
        setZone('');
        setContent('');
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
            <Card className="w-full max-w-md bg-dark-card border-dark-border shadow-xl relative">
                <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-2 h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={onClose}
                    disabled={submitting}
                >
                    <X className="h-4 w-4" />
                </Button>

                <CardHeader>
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full bg-dark-bg border border-dark-border ${config.color}`}>
                            <Icon className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-lg">{config.title}</CardTitle>
                            <CardDescription>{config.description}</CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <label
                                htmlFor="sighting-zone"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
                            >
                                Zona Aproximada / Ubicación <span className="text-red-500">*</span>
                            </label>
                            <Input
                                id="sighting-zone"
                                placeholder="Ej: Plaza Colón, Cerca de la parada del 60..."
                                value={zone}
                                onChange={(e) => setZone(e.target.value)}
                                disabled={submitting}
                                autoFocus
                                className="bg-dark-bg border-dark-border focus:border-neon-green/50"
                            />
                        </div>

                        <div className="space-y-2">
                            <label
                                htmlFor="sighting-content"
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-foreground"
                            >
                                Comentario (Opcional)
                            </label>
                            <Textarea
                                id="sighting-content"
                                placeholder="Detalles visuales, hora aproximada, etc."
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                disabled={submitting}
                                maxLength={250}
                                className="bg-dark-bg border-dark-border focus:border-neon-green/50 resize-none min-h-[80px]"
                            />
                            <p className="text-xs text-right text-muted-foreground">{content.length}/250</p>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-4 mt-6 items-center">
                            <div className="flex-1 flex items-center gap-2 text-xs text-muted-foreground order-2 sm:order-1">
                                <span>🕶️</span>
                                <span>Tu aporte es 100% anónimo</span>
                            </div>

                            <div className="flex gap-2 w-full sm:w-auto order-1 sm:order-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    onClick={onClose}
                                    disabled={submitting}
                                    className="flex-1 sm:flex-none"
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={!zone.trim() || submitting}
                                    className="bg-neon-green text-black hover:bg-neon-green/90 flex-1 sm:flex-none"
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Enviando...
                                        </>
                                    ) : (
                                        config.button
                                    )}
                                </Button>
                            </div>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}
