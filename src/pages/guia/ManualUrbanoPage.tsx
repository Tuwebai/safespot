import { Link } from 'react-router-dom';
import { ArrowLeft, Lightbulb, User, Moon } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function ManualUrbanoPage() {
    return (
        <>
            <SEO
                title="Manual Urbano: Guía de Sobrevivencia en Ciudad"
                description="Tips de seguridad urbana evergreen. Consejos sobre iluminación, lenguaje corporal y rutinas para evitar ser un blanco fácil."
                keywords={['manual urbano', 'seguridad', 'tips seguridad', 'prevencion', 'calle segura']}
                url="https://safespot.tuweb-ai.com/intel/manual-urbano"
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm font-semibold mb-6">
                            <Lightbulb className="h-4 w-4" />
                            <span>Educación Cívica</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Manual <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-500">Urbano</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            Consejos evergreen para sobrevivir la ciudad. Ajustes pequeños en tu rutina que te hacen invisible para el delito oportunista.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="p-6 bg-zinc-900 border border-white/10 rounded-2xl">
                            <h3 className="font-bold text-white text-xl mb-4 flex items-center gap-2"><Moon className="text-yellow-400" /> Iluminación</h3>
                            <p className="text-zinc-400">Caminá siempre en sentido contrario al tránsito (para que no te sorprendan de atrás en auto/moto) y por la vereda más iluminada, aunque sea el camino más largo.</p>
                        </div>
                        <div className="p-6 bg-zinc-900 border border-white/10 rounded-2xl">
                            <h3 className="font-bold text-white text-xl mb-4 flex items-center gap-2"><User className="text-yellow-400" /> Lenguaje Corporal</h3>
                            <p className="text-zinc-400">Caminá con propósito. Cabeza levantada, no mirando el celular. Si parecés perdido o distraído, sos un blanco.</p>
                        </div>
                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/prediccion-del-delito" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Predicción
                        </Link>
                        <Link to="/confianza/sistema-de-confianza" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Sistema de Confianza <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
