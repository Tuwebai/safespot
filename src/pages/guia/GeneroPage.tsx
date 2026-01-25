import { Link } from 'react-router-dom';
import { ArrowLeft, HeartHandshake, Phone, Shield, Users, ExternalLink } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function GeneroPage() {
    return (
        <>
            <SEO
                title="Violencia de Género: Recursos y Ayuda"
                description="Red de contención y recursos para violencia de género. Línea 144, uso seguro de SafeSpot y protocolos de ayuda anónima."
                keywords={['violencia de genero', 'linea 144', 'ayuda mujer', 'denuncia', 'ni una menos', 'recursos', 'seguridad']}
                url="https://safespot.tuweb-ai.com/intel/violencia-de-genero"
            />
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-purple-500/30">
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold mb-6">
                            <HeartHandshake className="h-4 w-4" />
                            <span>Comunidad Segura</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            No estás <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">sola</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            Si sufrís violencia o conocés a alguien que la sufre, hay una red lista para contenerte y actuar. No es tu culpa.
                        </p>
                    </div>

                    <div className="space-y-16">

                        {/* 1. Recursos Inmediatos */}
                        <section className="bg-purple-900/10 border border-purple-500/20 rounded-2xl p-8 md:p-10">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-purple-200">
                                <Phone className="h-7 w-7 text-purple-400" />
                                Líneas de Ayuda 24hz
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-purple-950/40 p-6 rounded-xl border border-purple-500/30">
                                    <h3 className="text-3xl font-black text-white mb-2">144</h3>
                                    <strong className="block text-purple-300 mb-2">Asesoramiento Nacional</strong>
                                    <p className="text-sm text-zinc-400">Atención, contención y asesoramiento en situaciones de violencia de género. Gratis, anónimo, todo el país.</p>
                                </div>
                                <div className="bg-purple-950/40 p-6 rounded-xl border border-purple-500/30">
                                    <h3 className="text-3xl font-black text-white mb-2">911</h3>
                                    <strong className="block text-purple-300 mb-2">Emergencias</strong>
                                    <p className="text-sm text-zinc-400">Si hay riesgo de vida inmediato o estás en medio de una agresión. No cortes.</p>
                                </div>
                            </div>
                        </section>

                        {/* 2. SafeSpot Seguro */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <Shield className="h-6 w-6 text-purple-400" />
                                Uso Seguro de SafeSpot
                            </h2>
                            <div className="bg-zinc-900/50 p-8 rounded-2xl">
                                <p className="text-zinc-300 mb-6 leading-relaxed">
                                    Entendemos que podés estar siendo vigilada. SafeSpot está diseñado para protegerte:
                                </p>
                                <ul className="space-y-4 text-zinc-400">
                                    <li className="flex gap-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-2 shrink-0"></div>
                                        <span>Tus reportes pueden ser totalmente anónimos.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-2 shrink-0"></div>
                                        <span>No guardamos historial de búsqueda en local.</span>
                                    </li>
                                    <li className="flex gap-3">
                                        <div className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-2 shrink-0"></div>
                                        <span>Si usás SafeSpot para pedir ayuda en el mapa, usá un dispositivo seguro o el de una vecina de confianza.</span>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* 3. Recursos Externos */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <Users className="h-6 w-6 text-purple-400" />
                                Red de Contención
                            </h2>
                            <div className="grid md:grid-cols-2 gap-4">
                                <a href="https://www.argentina.gob.ar/generos/guia-de-recursos-provinciales" target="_blank" rel="noopener noreferrer" className="flex items-center justify-between p-4 bg-zinc-900 hover:bg-zinc-800 rounded-lg border border-white/5 transition-colors group">
                                    <span className="font-medium text-white">Mapa de Recursos Provinciales</span>
                                    <ExternalLink className="h-4 w-4 text-zinc-500 group-hover:text-white" />
                                </a>
                            </div>
                        </section>

                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/perdiste-al-firu" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Mascotas
                        </Link>
                        <Link to="/intel/habla-sin-miedo" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Hablá Sin Miedo <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
