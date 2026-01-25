import React from 'react';
import { MapPin, Users, Lightbulb, Activity, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SEO } from '@/components/SEO';

export const CorredoresSegurosPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <>
            <SEO
                title="Corredores Seguros: Tu Barrio Inteligente"
                description="Mapa de calles seguras en GBA. Rutas con iluminación LED, cámaras y red vecinal activa. Planificá tu camino y evitá zonas de riesgo."
                keywords={['corredores seguros', 'mapa seguridad', 'gba norte', 'calles seguras', 'iluminacion', 'prevencion']}
                url="https://safespot.tuweb-ai.com/intel/corredores-seguros"
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
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold uppercase tracking-widest mb-4">
                            <MapPin className="w-3 h-3" />
                            Inteligencia Barrial
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4">
                            Tu Barrio <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">Seguro</span>
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-400 font-light leading-relaxed max-w-2xl">
                            Calles con más luz, cámaras y vecinos atentos reducen el riesgo exponencialmente.
                        </p>
                    </motion.div>

                    {/* Introducción */}
                    <div className="prose prose-invert max-w-none mb-16">
                        <p className="text-lg text-gray-300 leading-relaxed border-l-4 border-neon-green/30 pl-6">
                            La seguridad no es solo policial; es ambiental y comunitaria. Un "Corredor Seguro" es una ruta elegida por su visibilidad, iluminación y presencia de actividad (comercios, garitas, flujo de gente). Usar estas rutas reduce la probabilidad de ser elegido como víctima.
                        </p>
                    </div>

                    {/* Sección: Señales Urbanas */}
                    <div className="mb-16">
                        <h3 className="text-2xl font-bold text-white mb-8">Señales de un Corredor Seguro</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-dark-card border border-white/5 p-6 rounded-2xl hover:border-blue-500/30 transition-colors">
                                <Lightbulb className="w-8 h-8 text-yellow-400 mb-4" />
                                <h4 className="text-lg font-bold text-white mb-2">Iluminación LED</h4>
                                <p className="text-sm text-gray-400">Calles con luz blanca y poda de árboles. La oscuridad es el mejor aliado del delito.</p>
                            </div>
                            <div className="bg-dark-card border border-white/5 p-6 rounded-2xl hover:border-blue-500/30 transition-colors">
                                <Activity className="w-8 h-8 text-neon-green mb-4" />
                                <h4 className="text-lg font-bold text-white mb-2">Flujo Activo</h4>
                                <p className="text-sm text-gray-400">Paradas de colectivo con gente, kioscos 24hs o estaciones de servicio.</p>
                            </div>
                            <div className="bg-dark-card border border-white/5 p-6 rounded-2xl hover:border-blue-500/30 transition-colors">
                                <Users className="w-8 h-8 text-blue-400 mb-4" />
                                <h4 className="text-lg font-bold text-white mb-2">Red Vecinal</h4>
                                <p className="text-sm text-gray-400">Cuadras con grupos de alerta o alarmas vecinales visibles.</p>
                            </div>
                        </div>
                    </div>

                    {/* Estrategias de Rutina */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">
                        <section>
                            <h3 className="text-2xl font-bold text-white mb-6 text-neon-green">Hábitos Inteligentes</h3>
                            <ul className="space-y-4">
                                {[
                                    "Variá tus horarios y rutas levemente para no ser predecible.",
                                    "Conocé los 'refugios': identificá qué comercios abren tarde en tu camino.",
                                    "Saludá a tus vecinos: generar vínculo aumenta la probabilidad de que te ayuden.",
                                    "Usá SafeSpot para ver alertas recientes en tu ruta antes de salir."
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4 items-start">
                                        <span className="w-1.5 h-1.5 rounded-full bg-neon-green mt-2 shrink-0" />
                                        <p className="text-gray-300 text-sm">{item}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section>
                            <h3 className="text-2xl font-bold text-white mb-6 text-red-400">Qué evitar</h3>
                            <ul className="space-y-4">
                                {[
                                    "Atajos por plazas cerradas o pasajes oscuros para 'ganar tiempo'.",
                                    "Caminar pegado a la línea de edificación (portones) donde pueden esconderse.",
                                    "Ignorar vehículos desconocidos estacionados con gente adentro.",
                                    "Usar el celular mientras caminás las últimas cuadras a casa."
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4 items-start">
                                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-2 shrink-0" />
                                        <p className="text-gray-300 text-sm">{item}</p>
                                    </li>
                                ))}
                            </ul>
                        </section>
                    </div>

                    {/* Cierre Institucional */}
                    <div className="text-center py-12 border-t border-white/5 bg-gradient-to-b from-dark-card/30 to-transparent rounded-3xl">
                        <div className="mx-auto w-16 h-16 bg-neon-green/10 rounded-full flex items-center justify-center mb-6">
                            <MapPin className="w-8 h-8 text-neon-green" />
                        </div>
                        <h4 className="text-2xl font-bold text-white mb-2">Conocé tu Territorio</h4>
                        <p className="text-gray-400 max-w-lg mx-auto mb-8">
                            SafeSpot mapea las zonas de riesgo en tiempo real basándose en reportes de tus vecinos.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button
                                size="lg"
                                className="bg-neon-green text-black font-bold h-12 px-10 rounded-full hover:bg-neon-green/90 shadow-[0_0_20px_rgba(0,255,157,0.3)] transition-transform hover:scale-105"
                                onClick={() => navigate('/explorar')}
                            >
                                Explorar Mapa
                            </Button>
                        </div>
                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/protocolo-anti-pirana" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Protocolo Anti-Piraña
                        </Link>
                        <Link to="/intel/nocturna" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Nocturna <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </div>
            </div>
        </>
    );
};
