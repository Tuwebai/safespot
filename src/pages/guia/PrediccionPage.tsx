import { Link } from 'react-router-dom';
import { ArrowLeft, BrainCircuit, Activity } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function PrediccionPage() {
    return (
        <>
            <SEO
                title="Predicción de Delito: Inteligencia Artificial Urbana"
                description="Cómo SafeSpot usa datos históricos y reportes en tiempo real para predecir zonas calientes (Hot Zones). Tecnología al servicio de la prevención."
                keywords={['prediccion delito', 'inteligencia artificial', 'seguridad', 'hot zones', 'mapa del delito', 'algoritmo']}
                url="https://safespot.tuweb-ai.com/intel/prediccion-del-delito"
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-semibold mb-6">
                            <BrainCircuit className="h-4 w-4" />
                            <span>Intel Predictivo</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Predicción de <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-500">Delito</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            No usamos magia. Usamos estadística geoespacial en tiempo real para alertarte cuando entras en una "Zona Caliente" antes de que suceda nada.
                        </p>
                    </div>

                    <div className="bg-zinc-900/50 p-8 rounded-2xl border border-white/5 text-center">
                        <Activity className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                        <h2 className="text-2xl font-bold text-white mb-4">Motor en Beta Privada</h2>
                        <p className="text-zinc-400 max-w-lg mx-auto">
                            Estamos calibrando nuestros algoritmos con los nuevos reportes de la comunidad. Esta sección se habilitará con datos públicos en la próxima versión Enterprise.
                        </p>
                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/protocolo-testigo" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Protocolo Testigo
                        </Link>
                        <Link to="/intel/manual-urbano" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Manual Urbano <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
