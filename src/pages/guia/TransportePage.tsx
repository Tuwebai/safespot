import { Link } from 'react-router-dom';
import { ArrowLeft, Train, Eye, Map, Briefcase, AlertOctagon, Smartphone } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function TransportePage() {
    return (
        <>
            <SEO
                title="Viajá Pillo: Seguridad en Transporte Público"
                description="Manual de seguridad para viajar en tren, subte y colectivo. Prevención de arrebatos y zonas de riesgo en el transporte público."
                keywords={['transporte publico', 'seguridad', 'subte', 'tren', 'bondi', 'arrebatos']}
                url="https://safespot.tuweb-ai.com/intel/viaja-pillo-transporte"
            />
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-neon-green/30">
                <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                        <Link to="/" className="p-2 hover:bg-white/5 rounded-full transition-colors group">
                            <ArrowLeft className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight">Centro de Inteligencia</h1>
                    </div>
                </header>

                <main className="container mx-auto px-4 py-16 max-w-4xl">

                    <div className="text-center mb-20">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-semibold mb-6">
                            <Train className="h-4 w-4" />
                            <span>Movilidad Urbana</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Viajá <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-500">Pillo</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            El transporte público es la jungla. Aprendé a moverte en subte, tren y bondi sin regalarte. La prevención empieza antes de subir.
                        </p>
                    </div>

                    <div className="space-y-16">

                        {/* 1. Modalidades */}
                        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-8 md:p-10">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <AlertOctagon className="h-7 w-7 text-indigo-400" />
                                Riesgos Frecuentes
                            </h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="p-4 bg-black/40 rounded-lg">
                                    <strong className="block text-white mb-2">El Punga "Arrebato"</strong>
                                    <p className="text-sm text-zinc-400">Espera a que se cierren las puertas (subte/tren) para manotearte el celular y salir corriendo.</p>
                                </div>
                                <div className="p-4 bg-black/40 rounded-lg">
                                    <strong className="block text-white mb-2">El "Apretado"</strong>
                                    <p className="text-sm text-zinc-400">En hora pico, te empujan o te encierran entre dos. Mientras te acomodás, te abren la mochila.</p>
                                </div>
                                <div className="p-4 bg-black/40 rounded-lg">
                                    <strong className="block text-white mb-2">El "Durmiente"</strong>
                                    <p className="text-sm text-zinc-400">Si te dormís en el tren o bondi, sos pollo. Especialmente si tenés el celular en la mano o bolsillos flojos.</p>
                                </div>
                            </div>
                        </section>

                        {/* 2. Consejos Prácticos */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <Briefcase className="h-6 w-6 text-blue-400" />
                                Manual del Viajero
                            </h2>
                            <div className="space-y-4">
                                <div className="flex gap-4 p-6 bg-zinc-900/50 rounded-xl border border-white/5 items-start">
                                    <div className="p-2 bg-blue-500/20 rounded-lg text-blue-400"><Eye className="h-5 w-5" /></div>
                                    <div>
                                        <h3 className="font-bold text-white">Mochila Adelante, Siempre</h3>
                                        <p className="text-zinc-400 text-sm mt-1">
                                            No importa si queda feo. En el transporte público, tu espalda es ciega. La mochila va al pecho o entre las piernas en el piso.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-6 bg-zinc-900/50 rounded-xl border border-white/5 items-start">
                                    <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400"><Smartphone className="h-5 w-5" /></div>
                                    <div>
                                        <h3 className="font-bold text-white">Celular Lejos de la Puerta</h3>
                                        <p className="text-zinc-400 text-sm mt-1">
                                            Nunca uses el celular parado al lado de la puerta abierta. Es la zona de caza del 90% de los arrebatos.
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-6 bg-zinc-900/50 rounded-xl border border-white/5 items-start">
                                    <div className="p-2 bg-emerald-500/20 rounded-lg text-emerald-400"><Map className="h-5 w-5" /></div>
                                    <div>
                                        <h3 className="font-bold text-white">Chequeá las Paradas</h3>
                                        <p className="text-zinc-400 text-sm mt-1">
                                            Si vas a una zona que no conocés, mirá el "Mapa de Calor" en SafeSpot antes de bajar. Sabé dónde te metés.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 3. CTA */}
                        <section className="text-center bg-gradient-to-b from-transparent to-blue-900/20 p-8 rounded-2xl border border-white/5">
                            <h2 className="text-xl font-bold text-white mb-4">¿Viste algo raro en tu viaje?</h2>
                            <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                                Ayudá a otros pasajeros. Si viste pungas en una estación o línea específica, reportalo anónimamente.
                            </p>
                            <Link to="/explorar" className="bg-white text-zinc-900 hover:bg-zinc-200 font-bold py-3 px-8 rounded-full shadow-lg transition-all">
                                Ver Mapa de Reportes
                            </Link>
                        </section>

                    </div>

                    {/* Footer Nav */}
                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/cuento-del-tio-ciberdelito" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Estafas
                        </Link>
                        <Link to="/intel/ojo-en-el-cajero" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Ojo en el Cajero <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
