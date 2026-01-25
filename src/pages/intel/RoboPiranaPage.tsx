import React from 'react';
import { Shield, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { SEO } from '@/components/SEO';

export const RoboPiranaPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <>
            <SEO
                title="Protocolo Anti-Piraña: Qué hacer durante el robo"
                description="Guía táctica para sobrevivir un robo piraña. Pasos críticos para los primeros 60 segundos. Priorizá tu vida y aprendé a actuar en frío."
                keywords={['robo piraña', 'seguridad', 'protocolo', 'prevención', 'argentina']}
                url="https://safespot.tuweb-ai.com/intel/protocolo-anti-pirana"
            />
            <div className="min-h-screen bg-transparent text-foreground pb-20 pt-24 md:pt-32">
                <div className="container mx-auto px-4 max-w-4xl">

                    {/* Header Institucional */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-12 text-center md:text-left"
                    >
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-widest mb-4">
                            <Shield className="w-3 h-3" />
                            Protocolo de Seguridad Nivel 1
                        </div>
                        <h1 className="text-4xl md:text-6xl font-bold text-white tracking-tight mb-4">
                            Protocolo Anti-Piraña
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-400 font-light leading-relaxed max-w-2xl">
                            Si te rodean, priorizá tu vida. Salir ileso en los primeros 60 segundos es la prioridad.
                        </p>
                    </motion.div>

                    {/* Introducción */}
                    <div className="prose prose-invert max-w-none mb-16">
                        <p className="text-lg text-gray-300 leading-relaxed border-l-4 border-neon-green/30 pl-6">
                            El "robo piraña" es una modalidad de ataque grupal, rápido y violento, diseñado para abrumar a la víctima por superioridad numérica. Ocurre típicamente en paradas de colectivo, zonas comerciales concurridas o semáforos. El objetivo es la sustracción rápida de objetos visibles (celular, mochila, vehículo).
                        </p>
                    </div>

                    {/* Grid de Acción */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-16">

                        {/* QUÉ HACER */}
                        <motion.section
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <h3 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
                                <CheckCircle className="w-6 h-6 text-neon-green" />
                                Qué hacer
                            </h3>
                            <ul className="space-y-4">
                                {[
                                    "Entrega inmediata: Soltá todo. Celular, mochila, llaves. Tu vida vale más que cualquier objeto.",
                                    "Manos visibles: Mantené las manos a la vista, palmadas abiertas, a la altura del pecho. Comunica 'no soy amenaza'.",
                                    "Mirada baja: Evitá el contacto visual directo y desafiante, pero no pierdas noción del entorno.",
                                    "Salida lateral: Si hay un hueco, desplazate lateralmente hacia una zona segura (comercio, edificio) sin correr bruscamente."
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                        <span className="text-neon-green font-bold font-mono">0{i + 1}</span>
                                        <p className="text-gray-300 text-sm">{item}</p>
                                    </li>
                                ))}
                            </ul>
                        </motion.section>

                        {/* QUÉ NO HACER */}
                        <motion.section
                            initial={{ opacity: 0, x: 20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true }}
                        >
                            <h3 className="flex items-center gap-3 text-2xl font-bold text-white mb-6">
                                <XCircle className="w-6 h-6 text-red-500" />
                                Qué NO hacer
                            </h3>
                            <ul className="space-y-4">
                                {[
                                    "No resistir: Nunca forcejees. La superioridad numérica hace imposible ganar. El riesgo de lesiones graves es altísimo.",
                                    "No gritar insultos: Esto puede escalar la violencia del grupo atacante.",
                                    "No perseguir: Una vez que huyen, no los sigas. Pueden estar armados o tener apoyo a metros de distancia.",
                                    "No sacar otra arma: Salvo que seas profesional entrenado, intentar defenderte en inferioridad 5 a 1 suele ser fatal."
                                ].map((item, i) => (
                                    <li key={i} className="flex gap-4 p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                        <span className="text-red-500 font-bold font-mono">NO</span>
                                        <p className="text-gray-300 text-sm">{item}</p>
                                    </li>
                                ))}
                            </ul>
                        </motion.section>
                    </div>

                    {/* Checklist Táctica */}
                    <div className="bg-dark-card border border-white/10 rounded-3xl p-8 md:p-12 mb-16 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-32 bg-neon-green/5 blur-3xl rounded-full pointer-events-none" />

                        <h3 className="text-2xl font-bold text-white mb-8 relative z-10">Checklist de Prevención Situacional</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10">
                            {[
                                { title: "Escaneo 360", desc: "Mirá a tu alrededor cada 2 minutos en paradas." },
                                { title: "Espalda Cubierta", desc: "No des la espalda a la calle o grupos grandes." },
                                { title: "Sin Auriculares", desc: "En zonas rojas, eliminá distracciones sonoras." },
                                { title: "Llaves en mano", desc: "Tenelas listas antes de llegar a la puerta." },
                                { title: "Modo Alerta", desc: "Si ves un grupo sospechoso, cruzá o entrá a un local." },
                                { title: "Bienes Ocultos", desc: "Celular guardado en vía pública, siempre." }
                            ].map((item, i) => (
                                <div key={i} className="flex flex-col gap-2">
                                    <span className="text-neon-green text-xs font-bold uppercase tracking-wider">{item.title}</span>
                                    <p className="text-gray-400 text-sm">{item.desc}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Cierre Institucional */}
                    <div className="text-center py-12 border-t border-white/5">
                        <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-6" />
                        <h4 className="text-2xl font-bold text-white mb-2">Comunidad Activa</h4>
                        <p className="text-gray-400 max-w-xl mx-auto mb-8">
                            La prevención la hacemos entre todos. Si ves algo sospechoso o fuiste víctima, reportalo para alertar a tus vecinos.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <Button
                                size="lg"
                                className="w-full sm:w-auto bg-neon-green text-black font-bold h-12 px-8 rounded-full hover:bg-neon-green/90"
                                onClick={() => navigate('/crear-reporte')}
                            >
                                Reportar Incidente
                            </Button>
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full sm:w-auto text-white border-white/20 h-12 px-8 rounded-full hover:bg-white/10"
                                onClick={() => navigate('/explorar')}
                            >
                                Ver Mapa de Riesgo
                            </Button>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
};
