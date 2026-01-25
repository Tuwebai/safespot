import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, ShieldCheck, Database } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function TransparenciaPage() {
    return (
        <>
            <SEO
                title="Sistema de Confianza: Transparencia y Validación"
                description="Cómo funciona la validación de reportes en SafeSpot. Auditoría de 3 capas: Algoritmo, Comunidad y Moderación. Política de Cero Datos Personales."
                keywords={['transparencia', 'validacion reportes', 'confianza', 'datos personales', 'moderacion', 'safespot']}
                url="https://safespot.tuweb-ai.com/confianza/sistema-de-confianza"
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-semibold mb-6">
                            <Scale className="h-4 w-4" />
                            <span>System Trust</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Sistema de <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-500">Confianza</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            Auditoría abierta de cómo validamos reportes y garantizamos que SafeSpot no sea usado para difamar ni mentir.
                        </p>
                    </div>

                    <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8">
                        <h2 className="text-2xl font-bold text-white mb-6">Validación de 3 Capas</h2>
                        <ul className="space-y-4">
                            <li className="flex gap-4"><ShieldCheck className="text-emerald-500 shrink-0" /> <span className="text-zinc-400"><strong>Capas 1 (Algorítmica):</strong> Filtramos spam, bots y palabras ofensivas automáticamante.</span></li>
                            <li className="flex gap-4"><Database className="text-emerald-500 shrink-0" /> <span className="text-zinc-400"><strong>Capa 2 (Comunitaria):</strong> Los usuarios con reputación votan la veracidad. -5 votos eliminan el reporte.</span></li>
                            <li className="flex gap-4"><Scale className="text-emerald-500 shrink-0" /> <span className="text-zinc-400"><strong>Capa 3 (Moderación):</strong> Equipo humano revisa reportes graves o denuncias de usuarios.</span></li>
                        </ul>
                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/manual-urbano" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Manual Urbano
                        </Link>
                        <Link to="/blog" className="hover:text-white transition-colors flex items-center gap-2">
                            Blog de Novedades <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>
                </main>
            </div>
        </>
    );
}
