import { Link } from 'react-router-dom';
import { ArrowLeft, PawPrint, Search, MapPin, Heart } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function MascotasPage() {
    return (
        <>
            <SEO
                title="¿Perdiste al Firu? Búsqueda de Mascotas"
                description="Guía rápida para recuperar mascotas perdidas. Protocolo de búsqueda barrial, alerta comunitaria y reporte en mapa."
                keywords={['mascotas perdidas', 'perro perdido', 'gato perdido', 'busqueda mascotas', 'vecinos', 'alerta']}
                url="https://safespot.tuweb-ai.com/intel/perdiste-al-firu"
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-sm font-semibold mb-6">
                            <PawPrint className="h-4 w-4" />
                            <span>Red de Búsqueda</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            ¿Perdiste al <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-500">Firu?</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            El tiempo es oro. Activá la búsqueda barrial inmediata. Tu mascota no se fue lejos, pero está asustada. Acá te decimos cómo encontrarla.
                        </p>
                    </div>

                    <div className="space-y-16">

                        {/* 1. Protocolo Hora Cero */}
                        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-8 md:p-10">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <Search className="h-7 w-7 text-orange-400" />
                                Protocolo Hora Cero
                            </h2>
                            <div className="space-y-6">
                                <div className="flex gap-4 items-start">
                                    <div className="h-8 w-8 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">1</div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Rastrillaje Físico</h3>
                                        <p className="text-zinc-400">Salí a caminar YA. Llevá su correa, su juguete con sonido y algo de comida caliente (el olor viaja). Llamalo con voz tranquila, no a los gritos.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="h-8 w-8 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">2</div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Alerta Vecinal</h3>
                                        <p className="text-zinc-400">Avisá a los locales de la cuadra, al diariero y a los paseadores de perros de la plaza. Ellos son los ojos de la calle.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 items-start">
                                    <div className="h-8 w-8 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center shrink-0">3</div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Reporte en SafeSpot</h3>
                                        <p className="text-zinc-400">Subí la foto a SafeSpot. Esto notifica a los usuarios cercanos. Usá una foto CLARA, sin filtros.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 2. Cómo Reportar Bien */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <MapPin className="h-6 w-6 text-amber-400" />
                                Claves para un Buen Reporte
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                    <strong className="block text-white mb-2">La Foto</strong>
                                    <p className="text-sm text-zinc-400">De cuerpo entero. Que se vean manchas distintivas o el collar. No pongas fotos borrosas o de cachorrito si ya es adulto.</p>
                                </div>
                                <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                    <strong className="block text-white mb-2">Datos Clave</strong>
                                    <p className="text-sm text-zinc-400">¿Tiene chapita? ¿Responde a su nombre? ¿Es miedoso? ¿Necesita medicación? (Esto último es vital para acelerar la empatía).</p>
                                </div>
                            </div>
                        </section>

                        {/* 3. CTA Emocional */}
                        <section className="text-center py-12">
                            <Heart className="h-12 w-12 text-neon-green mx-auto mb-6 animate-pulse" />
                            <h2 className="text-2xl font-bold text-white mb-4">No bajes los brazos</h2>
                            <p className="text-zinc-400 mb-8 max-w-lg mx-auto">
                                La mayoría de las mascotas se recuperan en las primeras 48hs gracias a la colaboración vecinal. Estamos con vos.
                            </p>
                            <Link to="/explorar" className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-orange-600/20 transition-all">
                                Buscar en el Mapa
                            </Link>
                        </section>

                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/ojo-en-el-cajero" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Bancos
                        </Link>
                        <Link to="/intel/violencia-de-genero" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Violencia de Género <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
