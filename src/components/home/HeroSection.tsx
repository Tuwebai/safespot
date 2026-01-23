import React from 'react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { Shield, Map as MapIcon, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { TacticalMapBackground } from './TacticalMapBackground';

interface HeroProps {
    activeUsers: number;
    totalReports?: number;
}

export const HeroSection: React.FC<HeroProps> = ({ activeUsers }) => {
    const navigate = useNavigate();

    return (
        <div className="relative w-full min-h-[85vh] flex flex-col items-center justify-center overflow-hidden bg-dark-bg">
            {/* Radar Background Effect */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <TacticalMapBackground />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0)_0%,rgba(theme('colors.dark-bg'),1)_80%)]" />
                <div className="absolute inset-0 bg-dark-bg/60 backdrop-blur-[1px]" />
            </div>

            {/* Content */}
            <div className="relative z-10 text-center px-4 max-w-4xl mx-auto space-y-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neon-green/10 border border-neon-green/20 mb-6 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-neon-green animate-pulse" />
                        <span className="text-neon-green text-xs font-bold uppercase tracking-wider">
                            {activeUsers.toLocaleString()} Vecinos activos auditando la zona
                        </span>
                    </div>

                    <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/70">
                        Red de Seguridad<br />
                        Colaborativa
                    </h1>

                    <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
                        Detectá incidencias, protegé tu zona y recuperá lo tuyo. SafeSpot unifica inteligencia ciudadana con tecnología de privacidad avanzada.
                    </p>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
                >
                    <Button
                        size="lg"
                        className="h-14 px-8 rounded-full bg-neon-green text-black font-bold text-lg hover:bg-neon-green/90 hover:scale-105 transition-all shadow-[0_0_20px_rgba(0,255,157,0.3)] group relative overflow-hidden"
                        onClick={() => navigate('/crear-reporte')}
                    >
                        <Shield className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                        REPORTAR
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12" />
                    </Button>

                    <Button
                        size="lg"
                        variant="outline"
                        className="h-14 px-8 rounded-full border-border text-foreground hover:bg-accent hover:text-accent-foreground backdrop-blur-md transition-all text-lg"
                        onClick={() => navigate('/explorar')}
                    >
                        <MapIcon className="w-5 h-5 mr-2" />
                        EXPLORAR MAPA
                    </Button>
                </motion.div>
            </div>

            {/* Scroll Indicator */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1, duration: 1 }}
                className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-gray-500"
            >
                <span className="text-[10px] uppercase tracking-[0.2em]">Scroll para monitorear</span>
                <ChevronRight className="w-5 h-5 rotate-90 animate-bounce" />
            </motion.div>
        </div>
    );
};
