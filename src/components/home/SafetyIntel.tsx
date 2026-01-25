import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Shield, MapPin, BookOpen, Smartphone, Train, Landmark, HeartHandshake, PawPrint, FileWarning, ClipboardList, BrainCircuit, Lightbulb, Scale } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// 🧠 Enterprise Intel Data (Rich Format & Localized)
const INTEL_DATA = [
    {
        id: '1',
        category: 'Emergencia',
        title: 'Protocolo Anti-Piraña',
        description: 'Si te rodean, priorizá tu vida. Guía rápida para actuar en frío y salir ileso en 60 segundos.',
        icon: Shield,
        actionLabel: 'Ver Pasos',
        action: '/intel/protocolo-anti-pirana',
        stats: 'Vital'
    },
    {
        id: '2',
        category: 'Tu Barrio',
        title: 'Corredores Seguros',
        description: 'Chequeá por dónde conviene moverse. Calles con más luz, cámaras y vecinos atentos en GBA Norte.',
        icon: MapPin,
        actionLabel: 'Ver Mapa',
        action: '/intel/corredores-seguros',
        stats: '+3 Zonas'
    },
    {
        id: '3',
        category: 'Prevención',
        title: '¿Volvés Tarde?',
        description: 'No seas un blanco fácil al entrar a casa. Tips clave para bajarte del auto o bondi sin regalarte.',
        icon: BookOpen,
        actionLabel: 'Leer Tips',
        action: '/intel/nocturna',
        stats: 'Nuevo'
    },
    {
        id: '4',
        category: 'Ciberdelito',
        title: 'Cuento del Tío 2.0',
        description: 'No caigas en la de "te ganaste un auto". Guía para detectar phishing, estafas en Marketplace y clonación de WhatsApp.',
        icon: Smartphone,
        actionLabel: 'Anti-Estafas',
        action: '/intel/cuento-del-tio-ciberdelito',
        stats: 'Alerta'
    },
    {
        id: '5',
        category: 'Movilidad',
        title: 'Viajá Pillo',
        description: 'Subte, Tren y Bondi. Dónde pararte, qué mirar y la mochila siempre adelante para que no te pungueen.',
        icon: Train,
        actionLabel: 'Ver Guía',
        action: '/intel/viaja-pillo-transporte',
        stats: 'Diario'
    },
    {
        id: '6',
        category: 'Bancos',
        title: 'Ojo en el Cajero',
        description: 'Si sacás efectivo, no te regales. Rutas de escape, cómo detectar marcadores y evitar salideras.',
        icon: Landmark,
        actionLabel: 'Seguridad',
        action: '/intel/ojo-en-el-cajero',
        stats: 'Crítico'
    },
    {
        id: '7',
        category: 'Comunidad',
        title: 'Violencia de Género',
        description: 'No estás sola. Recursos directos, línea 144 y red de contención segura. Pedí ayuda sin dejar rastro.',
        icon: HeartHandshake,
        actionLabel: 'Pedir Ayuda',
        action: '/intel/violencia-de-genero',
        stats: 'Ayuda'
    },
    {
        id: '8',
        category: 'Mascotas',
        title: '¿Perdiste al Firu?',
        description: 'Red de búsqueda barrial activada. Cómo reportar mascotas perdidas y alertar a veterinarias cercanas.',
        icon: PawPrint,
        actionLabel: 'Buscar',
        action: '/intel/perdiste-al-firu',
        stats: 'Red'
    },
    {
        id: '9',
        category: 'Justicia',
        title: 'Hablá Sin Miedo',
        description: '¿Viste algo turbio en el barrio? Cómo realizar denuncias anónimas sobre venta de drogas o trata.',
        icon: FileWarning,
        actionLabel: 'Denunciar',
        action: '/intel/habla-sin-miedo',
        stats: 'Anónimo'
    },
    {
        id: '10',
        category: 'Playbook',
        title: 'Protocolo Testigo',
        description: 'Protocolo de acción fría. Qué hacer, qué NO hacer y cómo ayudar a la víctima sin ponerte en riesgo. Guía paso a paso.',
        icon: ClipboardList,
        actionLabel: 'Ver Protocolo',
        action: '/intel/protocolo-testigo',
        stats: 'Táctico'
    },
    {
        id: '11',
        category: 'Intel',
        title: 'Predicción de Delito',
        description: 'No es magia, son datos. Cómo nuestro algoritmo cruza reportes históricos y tiempo real para detectar zonas calientes antes de que pases.',
        icon: BrainCircuit,
        actionLabel: 'Tecnología',
        action: '/intel/prediccion-del-delito',
        stats: 'Beta'
    },
    {
        id: '12',
        category: 'Educación',
        title: 'Manual Urbano',
        description: 'Errores de novato que te exponen. Desde usar el celu en la parada hasta caminar por la sombra. Ajustá tu rutina hoy.',
        icon: Lightbulb,
        actionLabel: 'Leer Manual',
        action: '/intel/manual-urbano',
        stats: 'Evergreen'
    },
    {
        id: '13',
        category: 'Transparencia',
        title: 'Sistema de Confianza',
        description: '¿Cómo validamos lo que ves? Proceso de verificación de reportes y política de "Cero Datos Personales". Tu privacidad es blindada.',
        icon: Scale,
        actionLabel: 'System Trust',
        action: '/confianza/sistema-de-confianza',
        stats: 'Enterprise'
    }
];

export const SafetyIntel: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(0);
    const navigate = useNavigate();

    const nextSlide = () => {
        setActiveIndex((current) => (current + 1) % INTEL_DATA.length);
    };

    const prevSlide = () => {
        setActiveIndex((current) => (current - 1 + INTEL_DATA.length) % INTEL_DATA.length);
    };

    // Calculate indices for 3-card view
    const getIndex = (offset: number) => {
        return (activeIndex + offset + INTEL_DATA.length) % INTEL_DATA.length;
    };

    const prevIndex = getIndex(-1);
    const nextIndex = getIndex(1);

    const visibleItems = [
        { ...INTEL_DATA[prevIndex], position: 'left', index: prevIndex },
        { ...INTEL_DATA[activeIndex], position: 'center', index: activeIndex },
        { ...INTEL_DATA[nextIndex], position: 'right', index: nextIndex }
    ];

    return (
        <div className="w-full py-16 relative overflow-hidden select-none">
            {/* Header */}
            <div className="container mx-auto px-4 mb-12 text-center md:text-left">
                <h2 className="text-3xl font-bold text-foreground tracking-tight">Centro de Inteligencia</h2>
                <p className="text-muted-foreground text-sm mt-2 max-w-xl mx-auto md:mx-0">
                    Recursos tácticos y actualizaciones estratégicas.
                </p>
            </div>

            {/* Carousel Stage - Wider container for 3 cards */}
            <div className="relative w-full max-w-[1400px] mx-auto h-[450px] flex items-center justify-center perspective-1000">

                {/* Navigation Buttons (Absolute) */}
                <button
                    onClick={prevSlide}
                    className="absolute left-4 md:left-12 z-30 w-12 h-12 rounded-full border border-border bg-card/80 hover:bg-accent flex items-center justify-center text-foreground backdrop-blur-md transition-all hover:scale-110 shadow-lg"
                >
                    <ArrowLeft className="w-5 h-5" />
                </button>

                <button
                    onClick={nextSlide}
                    className="absolute right-4 md:right-12 z-30 w-12 h-12 rounded-full border border-border bg-card/80 hover:bg-accent flex items-center justify-center text-foreground backdrop-blur-md transition-all hover:scale-110 shadow-lg"
                >
                    <ArrowRight className="w-5 h-5" />
                </button>

                {/* Cards Container */}
                <div className="relative w-full h-full flex items-center justify-center">
                    <AnimatePresence initial={false} mode="popLayout">
                        {visibleItems.map((item) => {
                            const isCenter = item.position === 'center';
                            const isLeft = item.position === 'left';
                            const isRight = item.position === 'right';

                            return (
                                <motion.div
                                    key={item.id}
                                    // Removed layoutId to allow manual transform control without conflict
                                    initial={{
                                        scale: 0.85,
                                        opacity: 0,
                                        x: isLeft ? '-100%' : isRight ? '100%' : 0
                                    }}
                                    animate={{
                                        scale: isCenter ? 1 : 0.85,
                                        opacity: isCenter ? 1 : 0.7, // Increased visibility for side cards
                                        filter: isCenter ? 'blur(0px)' : 'blur(2px)', // Reduced blur for readability
                                        zIndex: isCenter ? 20 : 10,
                                        x: isCenter ? '0%' : isLeft ? '-95%' : '95%', // Wider spread (was 60%) to use space
                                        rotateY: isCenter ? 0 : isLeft ? 5 : -5 // Subtle rotation
                                    }}
                                    // FIX: Separate transition config to avoid negative blur values from spring
                                    transition={{
                                        filter: { duration: 0.3, ease: 'easeOut' },
                                        opacity: { duration: 0.3, ease: 'easeOut' },
                                        x: { type: "spring", stiffness: 180, damping: 25 },
                                        scale: { duration: 0.4 },
                                        rotateY: { duration: 0.4 }
                                    }}
                                    onClick={() => {
                                        if (isLeft) prevSlide();
                                        if (isRight) nextSlide();
                                    }}
                                    className={cn(
                                        "absolute w-[85%] md:w-[50%] lg:w-[45%] max-w-3xl h-[420px] md:h-[400px] rounded-[2rem] p-1 border overflow-hidden cursor-pointer",
                                        isCenter
                                            ? "bg-card border-primary/20 shadow-[0_0_50px_rgba(var(--primary),0.2)] cursor-default"
                                            : "bg-card/60 border-border hover:opacity-100 hover:scale-[0.87] transition-all"
                                    )}
                                >
                                    <div className="w-full h-full bg-card rounded-[1.8rem] overflow-hidden relative flex flex-col md:flex-row group">

                                        {/* Content Side */}
                                        <div className="flex-[1.5] p-6 md:p-10 flex flex-col justify-center relative z-10">
                                            {/* Header Tags */}
                                            <div className="flex items-center gap-3 mb-4 md:mb-6">
                                                <span className={cn(
                                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest",
                                                    isCenter ? "bg-neon-green/10 text-neon-green border border-neon-green/20" : "bg-muted text-muted-foreground"
                                                )}>
                                                    {item.category}
                                                </span>
                                            </div>

                                            {/* Title */}
                                            <h3 className={cn(
                                                "font-bold text-foreground mb-4 leading-tight transition-all",
                                                isCenter ? "text-2xl md:text-4xl" : "text-xl md:text-2xl"
                                            )}>
                                                {item.title}
                                            </h3>

                                            {/* Description (Only visible distinctively on center) */}
                                            <p className={cn(
                                                "text-muted-foreground mb-6 md:mb-8 transition-opacity duration-300",
                                                isCenter ? "opacity-100 text-xs sm:text-sm md:text-base" : "opacity-80 text-[10px] line-clamp-3" // Improved legibility on sides
                                            )}>
                                                {item.description}
                                            </p>

                                            {/* Actions (Only Center) */}
                                            {isCenter && (
                                                <div className="flex items-center gap-3">
                                                    <Button
                                                        className="bg-neon-green text-black hover:bg-neon-green/90 rounded-full px-6 font-bold text-sm shadow-[0_0_15px_rgba(0,255,157,0.2)]"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            navigate(item.action);
                                                        }}
                                                    >
                                                        {item.actionLabel}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>

                                        {/* Visual Side */}
                                        <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-muted/20 min-h-[140px] md:min-h-0">
                                            <div className="absolute inset-0 bg-dotted-pattern opacity-30" />
                                            {isCenter && <div className="absolute inset-0 bg-neon-green/5 blur-3xl animate-pulse-slow" />}

                                            <item.icon className={cn(
                                                "text-foreground transition-all duration-500",
                                                isCenter
                                                    ? "w-20 h-20 md:w-32 md:h-32 text-neon-green drop-shadow-[0_0_20px_rgba(0,255,157,0.4)]"
                                                    : "w-12 h-12 md:w-16 md:h-16 opacity-50"
                                            )} />
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>

                {/* Pagination Dots */}
                <div className="absolute -bottom-12 left-0 right-0 flex justify-center gap-3">
                    {INTEL_DATA.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setActiveIndex(idx)}
                            className={cn(
                                "rounded-full transition-all duration-300",
                                activeIndex === idx
                                    ? "bg-neon-green w-8 h-1.5"
                                    : "bg-muted hover:bg-muted-foreground w-1.5 h-1.5"
                            )}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
