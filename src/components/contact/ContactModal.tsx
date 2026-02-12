import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Loader2 } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';
import { ensureAnonymousId } from '@/lib/identity';
import { sessionAuthority } from '@/engine/session/SessionAuthority';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { RippleButton } from '@/components/ui/RippleButton';
import { useToast } from '@/components/ui/toast';

// Validation Schema
const contactSchema = z.object({
    name: z.string().min(2, 'El nombre es muy corto'),
    email: z.string().email('Email inválido'),
    subject: z.string().min(3, 'El asunto es muy corto'),
    message: z.string().min(10, 'El mensaje es muy corto (mínimo 10 caracteres)'),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export function ContactModal({ isOpen, onClose }: ContactModalProps) {
    const { theme } = useTheme();
    // CRITICAL FIX: The custom useToast hook exposes specific methods, not a generic 'toast' function
    const { success, error: toastError } = useToast();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm<ContactFormData>({
        resolver: zodResolver(contactSchema)
    });

    const onSubmit = async (data: ContactFormData) => {
        setIsSubmitting(true);
        try {
            // Use safe API request construction
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            // ✅ ENTERPRISE FIX #2: Use SSOT for identity via SessionAuthority
            // This ensures we use the same ID as the rest of the Motoring system.
            const anonymousId = sessionAuthority.getAnonymousId() || ensureAnonymousId();

            // Normalize: Remove trailing slash and /api suffix if present to ensure clean base
            const cleanBase = apiUrl.replace(/\/$/, '').replace(/\/api$/, '');

            const response = await fetch(`${cleanBase}/api/contact`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Anonymous-Id': anonymousId,
                },
                body: JSON.stringify(data), // Corrected from formData to data
            });

            const result = await response.json();

            if (!response.ok) throw new Error(result.message || 'Error al enviar');

            // CRITICAL FIX: Use the exposed 'success' method
            success("¡Mensaje enviado! Gracias por contactarnos. Te responderemos pronto.");

            reset();
            onClose();
        } catch (err) {
            // CRITICAL FIX: Use the exposed 'error' method (renamed to avoid conflict)
            toastError(err instanceof Error ? err.message : "No pudimos enviar tu mensaje");
        } finally {
            setIsSubmitting(false);
        }
    };

    // Prevent closing when clicking content
    const handleContentClick = (e: React.MouseEvent) => e.stopPropagation();

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    >
                        {/* Modal Content */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            onClick={handleContentClick}
                            className="w-full max-w-md bg-dark-card border border-dark-border rounded-2xl shadow-2xl overflow-hidden"
                            style={{
                                // CRITICAL FIX: 'dark' is not a valid theme value. 'default' is the standard dark theme.
                                // We show green shadow for non-default themes or just always show a subtle shadow.
                                boxShadow: `0 0 40px -10px ${theme === 'neon' ? 'rgba(0, 255, 136, 0.2)' : 'rgba(0, 255, 136, 0.05)'}`
                            }}
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-dark-border flex justify-between items-center bg-dark-bg/50">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground">Contáctanos</h2>
                                    <p className="text-sm text-muted-foreground">Envíanos tus dudas o sugerencias</p>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 hover:bg-dark-border/50 rounded-full transition-colors text-muted-foreground hover:text-foreground"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">

                                {/* Name */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Nombre</label>
                                    <Input
                                        {...register('name')}
                                        placeholder="Tu nombre"
                                        className="bg-dark-bg border-dark-border focus:border-neon-green/50"
                                    />
                                    {errors.name && (
                                        <p className="text-xs text-red-400">{errors.name.message}</p>
                                    )}
                                </div>

                                {/* Email */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Email</label>
                                    <Input
                                        {...register('email')}
                                        type="email"
                                        placeholder="tu@email.com"
                                        className="bg-dark-bg border-dark-border focus:border-neon-green/50"
                                    />
                                    {errors.email && (
                                        <p className="text-xs text-red-400">{errors.email.message}</p>
                                    )}
                                </div>

                                {/* Subject */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Asunto</label>
                                    <Input
                                        {...register('subject')}
                                        placeholder="¿Sobre qué quieres hablar?"
                                        className="bg-dark-bg border-dark-border focus:border-neon-green/50"
                                    />
                                    {errors.subject && (
                                        <p className="text-xs text-red-400">{errors.subject.message}</p>
                                    )}
                                </div>

                                {/* Message */}
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-foreground">Mensaje</label>
                                    <Textarea
                                        {...register('message')}
                                        placeholder="Escribe tu mensaje aquí..."
                                        className="bg-dark-bg border-dark-border focus:border-neon-green/50 min-h-[120px]"
                                    />
                                    {errors.message && (
                                        <p className="text-xs text-red-400">{errors.message.message}</p>
                                    )}
                                </div>

                                {/* Submit Button */}
                                <div className="pt-2">
                                    <RippleButton
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="w-full justify-center bg-neon-green text-black hover:bg-neon-green/90 font-medium"
                                        rippleColor="rgba(0, 0, 0, 0.2)"
                                    >
                                        {isSubmitting ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Enviando...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4 mr-2" />
                                                Enviar Mensaje
                                            </>
                                        )}
                                    </RippleButton>
                                </div>

                            </form>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
