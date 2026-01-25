import React from 'react';
import { Moon, Eye, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SEO } from '@/components/SEO';

export const NocturnaPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <>
            <SEO
                title="¿Volvés Tarde? Seguridad Nocturna"
                description="Tips de seguridad para volver a casa de noche. Estrategias de 'Last Mile', transporte público y prevención de entraderas."
                keywords={['seguridad nocturna', 'volver a casa', 'entradera', 'transporte', 'noche', 'prevencion']}
                url="https://safespot.tuweb-ai.com/intel/nocturna"
            />
            <div className="min-h-screen bg-dark-bg text-foreground pb-20 pt-24 md:pt-32">
                <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                        <Link to="/" className="p-2 hover:bg-white/5 rounded-full transition-colors group">
                            <ArrowLeft className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight">Centro de Inteligencia</h1>
                    </div>
                </header>

                <div className="container mx-auto px-4 max-w-4xl">

                    {/* Header Institucional */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12 text-center md:text-left"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-bold uppercase tracking-widest mb-4">
                            <Moon className="w-3 h-3" />
                            Prevención Nocturna
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4">
                            ¿Volvés <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">Tarde?</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-400 font-light leading-relaxed max-w-2xl">
                            No seas un blanco fácil. Bajarte del bondi sin regalarte hace la diferencia.
                        </p>
                    </motion.div>

                    {/* Introducción */}
                    <div className="prose prose-invert max-w-none mb-16">
                        <p className="text-lg text-gray-300 leading-relaxed border-l-4 border-neon-green/30 pl-6">
                            El regreso a casa entre las 20:00 y las 06:00 es la franja de mayor exposición. La fatiga, la poca visibilidad y las calles vacías aumentan el riesgo. La clave no es vivir con miedo, sino con "atención situacional".
                        </p>
                    </div>

                    {/* Fases del Regreso */}
                    <div className="space-y-12 mb-16">

                        {/* Fase 1: Transporte */}
                        <div className="relative pl-8 border-l border-white/10">
                            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-dark-bg border border-white/20 flex items-center justify-center">
                                <span className="text-xs font-mono text-gray-500">1</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">En Transporte Público</h3>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <li className="bg-dark-card p-4 rounded-xl border border-white/5 text-sm text-gray-300 hover:border-purple-500/30 transition-colors">
                                    <strong>Parada Segura:</strong> Esperá en la parada más iluminada o con gente, aunque camines una cuadra más.
                                </li>
                                <li className="bg-dark-card p-4 rounded-xl border border-white/5 text-sm text-gray-300 hover:border-purple-500/30 transition-colors">
                                    <strong>Ubicación:</strong> En el colectivo, sentate cerca del chofer. En tren, vagón central.
                                </li>
                                <li className="bg-dark-card p-4 rounded-xl border border-white/5 text-sm text-gray-300 hover:border-purple-500/30 transition-colors">
                                    <strong>Anticipación:</strong> Guardá el celular en un bolsillo interno 2 paradas antes de bajar.
                                </li>
                            </ul>
                        </div>

                        {/* Fase 2: Caminata */}
                        <div className="relative pl-8 border-l border-white/10">
                            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-dark-bg border border-white/20 flex items-center justify-center">
                                <span className="text-xs font-mono text-gray-500">2</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">La Caminata Final (Last Mile)</h3>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <li className="bg-dark-card p-4 rounded-xl border border-white/5 text-sm text-gray-300 hover:border-purple-500/30 transition-colors">
                                    <strong>Caminata Decidida:</strong> Paso firme, cabeza levantada. No parezcas perdido ni cansado.
                                </li>
                                <li className="bg-dark-card p-4 rounded-xl border border-white/5 text-sm text-gray-300 hover:border-purple-500/30 transition-colors">
                                    <strong>Contramano:</strong> Caminá en sentido contrario al tránsito para ver los autos venir.
                                </li>
                                <li className="bg-dark-card p-4 rounded-xl border border-white/5 text-sm text-gray-300 hover:border-purple-500/30 transition-colors">
                                    <strong>Llaves listas:</strong> Tenelas en la mano dentro del bolsillo desde que bajás del transporte.
                                </li>
                            </ul>
                        </div>

                        {/* Fase 3: Entrada */}
                        <div className="relative pl-8 border-l border-white/10">
                            <div className="absolute -left-3 top-0 w-6 h-6 rounded-full bg-dark-bg border border-white/20 flex items-center justify-center">
                                <span className="text-xs font-mono text-gray-500">3</span>
                            </div>
                            <h3 className="text-xl font-bold text-white mb-4">Ingreso a Casa (Entradera)</h3>
                            <div className="bg-white/5 p-6 rounded-2xl border border-white/10">
                                <p className="text-gray-300 mb-4">El momento más crítico. Hacé un "barrido visual" de la cuadra antes de poner la llave/abrir el portón.</p>
                                <div className="flex gap-4">
                                    <div className="text-red-400 text-sm font-bold w-24 shrink-0">ALERTA ROJA</div>
                                    <p className="text-sm text-gray-400">Si ves autos desconocidos con motor encendido, motos dando vueltas o gente parada sin hacer nada: <strong>NO ENTRES</strong>. Seguí de largo y llamá al 911 o da una vuelta manzana.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Checklist Táctica */}
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-white/10 rounded-3xl p-8 mb-16">
                        <h3 className="text-xl font-bold text-white mb-6 text-center">Micro-Decisiones que Salvan</h3>
                        <div className="flex flex-wrap justify-center gap-4">
                            {[
                                "Sin Auriculares",
                                "Ubicación en Tiempo Real (WhatsApp)",
                                "Carga de Batería > 20%",
                                "No abrir a desconocidos",
                                "Mirada 360°"
                            ].map((tag, i) => (
                                <span key={i} className="px-4 py-2 rounded-full bg-dark-bg border border-white/10 text-sm text-gray-300 font-medium hover:border-neon-green/50 transition-colors cursor-default">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Cierre Institucional */}
                    <div className="text-center py-12 border-t border-white/5">
                        <Eye className="w-12 h-12 text-neon-green mx-auto mb-6" />
                        <h4 className="text-2xl font-bold text-white mb-2">Llegá Seguro</h4>
                        <p className="text-gray-400 max-w-xl mx-auto mb-8">
                            SafeSpot te permite ver zonas de riesgo antes de salir. Planificá tu vuelta.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button
                                size="lg"
                                className="w-full sm:w-auto bg-neon-green text-black font-bold h-12 px-8 rounded-full hover:bg-neon-green/90"
                                onClick={() => navigate('/explorar')}
                            >
                                Ver Mapa Nocturno
                            </Button>
                        </div>
                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/corredores-seguros" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Corredores Seguros
                        </Link>
                        <Link to="/intel/cuento-del-tio-ciberdelito" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Estafas <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </div>
            </div>
        </>
    );
};
