
import { useState, useEffect, useCallback } from 'react';
import { MapPin, AlertTriangle, Loader2, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BaseModal, ModalBody } from '@/components/ui/BaseModal';
import { useCreateReportMutation } from '@/hooks/mutations/useCreateReportMutation';
import { useToast } from '@/components/ui/toast/useToast';
import { URGENT_CATEGORIES, buildUrgentTitle, buildUrgentDescription, sanitizeZone } from '@/domain/report-utils';

interface UrgentReportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    currentLocation?: { lat: number; lng: number } | null;
}

export function UrgentReportDialog({ isOpen, onClose, currentLocation }: UrgentReportDialogProps) {
    const [step, setStep] = useState<'category' | 'sending' | 'success'>('category');
    const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
    const { mutate: createReport } = useCreateReportMutation();
    const toast = useToast();
    
    // Reset state when opening
    useEffect(() => {
        if (isOpen) {
            setStep('category');
            setSelectedCategory(null);
        }
    }, [isOpen]);

    const handleCategorySelect = useCallback((category: string) => {
        if (!currentLocation) {
            toast.error("Esperando ubicación precisa...");
            return;
        }

        setSelectedCategory(category);
        setStep('sending');

        const payload = {
            id: crypto.randomUUID(), // Client-side ID generation
            title: buildUrgentTitle(category),
            description: buildUrgentDescription(category),
            category: category,
            zone: sanitizeZone(''), // Backend will calculate
            address: 'Ubicación de emergencia detectada', // Placeholder
            latitude: currentLocation.lat,
            longitude: currentLocation.lng,
            incident_date: new Date().toISOString(),
            status: 'pendiente' as const
        };

        createReport(payload, {
            onSuccess: () => {
                setStep('success');
                // Auto-close after short delay to show success state
                setTimeout(() => {
                    onClose();
                }, 1500);
            },
            onError: (error) => {
                console.error("Urgent report failed", error);
                toast.error("No se pudo enviar el reporte. Intenta nuevamente.");
                setStep('category'); // Go back to allow retry
            }
        });
    }, [currentLocation, createReport, onClose, toast]);

    const renderCategoryGrid = () => (
        <div className="grid grid-cols-2 gap-3 mt-4">
            {URGENT_CATEGORIES.map((cat) => (
                <button
                    key={cat.id}
                    onClick={() => handleCategorySelect(cat.id)}
                    className="flex flex-col items-center justify-center p-4 bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800 hover:border-red-500/50 rounded-xl transition-all group active:scale-95"
                >
                    <span className="text-3xl mb-2 grayscale group-hover:grayscale-0 transition-all">{cat.icon}</span>
                    <span className="text-white font-bold text-sm tracking-tight">{cat.label}</span>
                </button>
            ))}
        </div>
    );

    const renderSendingState = () => (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 blur-xl rounded-full animate-pulse" />
                <Loader2 className="h-12 w-12 text-red-500 animate-spin relative z-10" />
            </div>
            <p className="text-zinc-400 font-medium animate-pulse">
                Enviando alerta de <span className="text-white font-bold">{selectedCategory}</span>...
            </p>
        </div>
    );

    const renderSuccessState = () => (
        <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-16 w-16 bg-green-500/20 rounded-full flex items-center justify-center mb-2 animate-in zoom-in duration-300">
                <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-white">¡Reporte Enviado!</h3>
            <p className="text-zinc-500 text-sm">La comunidad ha sido alertada.</p>
        </div>
    );

    return (
        <BaseModal
            isOpen={isOpen}
            onClose={onClose}
            layer="emergency"
            size="sm"
            className="bg-zinc-950 border-zinc-800 text-white overflow-hidden p-0"
        >
            {/* Header de Emergencia */}
            <div className="bg-gradient-to-r from-red-900/40 to-zinc-900 border-b border-red-900/20 p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/10 rounded-lg">
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                    </div>
                    <div>
                        <h2 className="font-bold text-lg leading-tight">Reporte Urgente</h2>
                        <p className="text-xs text-red-400/80 font-medium">Prioridad Alta</p>
                    </div>
                </div>
                {step !== 'sending' && (
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
                        <X className="h-5 w-5" />
                    </Button>
                )}
            </div>

            {/* Location Preview (Mini) */}
            {step === 'category' && (
                <div className="px-6 pt-6 pb-2">
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mb-2">
                        <MapPin className="h-3 w-3 text-neon-green" />
                        <span>Ubicación detectada:</span>
                        {currentLocation ? (
                            <span className="text-zinc-300 font-mono">
                                {currentLocation.lat.toFixed(4)}, {currentLocation.lng.toFixed(4)}
                            </span>
                        ) : (
                            <span className="text-amber-500 flex items-center gap-1">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Precisando GPS...
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Contenido Principal */}
            <ModalBody className="p-6 pt-0">
                {step === 'category' && (
                    <>
                        <p className="text-sm text-zinc-400 mb-4">
                            Selecciona la categoría del incidente. Se enviará inmediatamente.
                        </p>
                        {renderCategoryGrid()}
                    </>
                )}

                {step === 'sending' && renderSendingState()}
                
                {step === 'success' && renderSuccessState()}
            </ModalBody>
        </BaseModal>
    );
}
