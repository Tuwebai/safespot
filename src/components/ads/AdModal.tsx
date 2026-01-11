import { useState, useEffect } from 'react';
import { X, Heart, Star, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AnimatePresence, motion } from 'framer-motion';

export function AdModal() {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Show "Ad" after 15 seconds (Simulated Ad Logic)
        const hasSeenAd = sessionStorage.getItem('safespot_ad_seen');
        if (!hasSeenAd) {
            const timer = setTimeout(() => {
                setIsOpen(true);
                sessionStorage.setItem('safespot_ad_seen', 'true');
            }, 15000);
            return () => clearTimeout(timer);
        }
    }, []);

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative w-full max-w-sm bg-card border border-neon-green/30 rounded-2xl shadow-[0_0_30px_rgba(0,255,136,0.15)] overflow-hidden"
                >
                    {/* Close Button */}
                    <button
                        onClick={() => setIsOpen(false)}
                        className="absolute top-3 right-3 p-1 rounded-full bg-black/20 hover:bg-black/40 text-white/70 hover:text-white transition-colors z-20"
                    >
                        <X size={20} />
                    </button>

                    {/* Special "Ad" Badge */}
                    <div className="absolute top-3 left-3 bg-yellow-500/20 text-yellow-500 text-[10px] font-bold px-2 py-0.5 rounded border border-yellow-500/30">
                        PUBLICIDAD
                    </div>

                    {/* Content */}
                    <div className="p-6 pt-12 text-center relative">
                        {/* Background Glow */}
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-40 bg-neon-green/20 blur-3xl rounded-full -z-10" />

                        <div className="mb-4 flex justify-center">
                            <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-neon-green to-emerald-600 rounded-xl flex items-center justify-center rotate-3 shadow-lg">
                                    <Star className="w-8 h-8 text-black fill-black" />
                                </div>
                                <div className="absolute -top-2 -right-2">
                                    <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
                                </div>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-2">
                            ¡Hacete Premium!
                        </h3>
                        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                            Apoyá a la comunidad y desbloqueá insignias exclusivas, personalización avanzada y priorización en el feed.
                        </p>

                        <div className="space-y-3">
                            <Button
                                className="w-full bg-neon-green text-black font-bold hover:bg-neon-green/90 neon-glow"
                                onClick={() => {
                                    window.open('https://link.mercadopago.com.ar/safespotapp', '_blank');
                                    setIsOpen(false);
                                }}
                            >
                                <Heart className="w-4 h-4 mr-2 fill-current" />
                                Colaborar con SafeSpot
                            </Button>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-xs text-muted-foreground hover:text-white transition-colors underline decoration-dotted"
                            >
                                No gracias, prefiero ser free
                            </button>
                        </div>
                    </div>

                    {/* Footer Strip */}
                    <div className="bg-black/40 py-2 px-4 text-[10px] text-center text-muted-foreground/50 border-t border-white/5">
                        SafeSpot no comparte tus datos con nadie. Esta publicidad es interna.
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
}
