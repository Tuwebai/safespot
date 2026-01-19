import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { X, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AuthRequiredModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Auth Required Modal
 * 
 * Modal global que se muestra cuando un usuario anónimo intenta
 * realizar una acción que requiere autenticación.
 * 
 * ✅ UX clara: explica por qué necesita cuenta
 * ✅ NO redirect silencioso
 * ✅ NO rompe navegación
 * ✅ Permite cancelar y volver
 */
export function AuthRequiredModal({ isOpen, onClose }: AuthRequiredModalProps) {
    const navigate = useNavigate();

    const handleRegister = () => {
        onClose();
        navigate('/register');
    };

    const handleLogin = () => {
        onClose();
        navigate('/login');
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden"
                    >
                        {/* Header */}
                        <div className="p-6 border-b border-border flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold text-foreground">
                                    Necesitás una cuenta
                                </h2>
                                <p className="text-sm text-foreground/60 mt-1">
                                    Para continuar con esta acción
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 hover:bg-border/50 rounded-full transition-colors text-foreground/70 hover:text-foreground"
                                aria-label="Cerrar"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-4">
                            <p className="text-foreground/80">
                                Estás usando <strong>SafeSpot como invitado</strong>.
                                <br />
                                Para crear reportes y participar, necesitás registrarte.
                            </p>

                            {/* CTAs */}
                            <div className="space-y-3 pt-2">
                                <Button
                                    onClick={handleRegister}
                                    className="w-full bg-neon-green text-black hover:bg-neon-green/90 font-medium"
                                >
                                    <UserPlus className="w-4 h-4 mr-2" />
                                    Crear cuenta
                                </Button>

                                <Button
                                    onClick={handleLogin}
                                    variant="outline"
                                    className="w-full"
                                >
                                    <LogIn className="w-4 h-4 mr-2" />
                                    Iniciar sesión
                                </Button>
                            </div>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
