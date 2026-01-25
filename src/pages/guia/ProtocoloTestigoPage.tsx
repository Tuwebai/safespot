import { Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function ProtocoloTestigoPage() {
    return (
        <>
            <SEO
                title="Protocolo Testigo: Qué hacer si ves un robo"
                description="Playbook táctico para testigos de robo. Reglas de oro para ayudar sin ponerte en riesgo. Cómo contener a la víctima y qué datos observar."
                keywords={['testigo robo', 'protocolo', 'que hacer robo', 'ayuda victima', 'seguridad ciudadana']}
                url="https://safespot.tuweb-ai.com/intel/protocolo-testigo"
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
                            <ClipboardList className="h-4 w-4" />
                            <span>Playbook Táctico</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Protocolo <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-500">Testigo</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            Presenciar un robo paraliza. Esta guía te dice exactamente qué hacer para ayudar sin convertirte en otra víctima.
                        </p>
                    </div>

                    <div className="space-y-16">
                        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-8 md:p-10">
                            <h2 className="text-2xl font-bold mb-6 text-white">Reglas de Oro</h2>
                            <div className="space-y-6">
                                <div className="flex gap-4">
                                    <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">1</div>
                                    <div><strong className="block text-white">No intervengas físicamente</strong><span className="text-zinc-400">Tu vida vale más que un celular. Hacé ruido, gritá "Fuego" (llama más la atención que "Policía"), pero no te metas en la pelea.</span></div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">2</div>
                                    <div><strong className="block text-white">Memorizá detalles</strong><span className="text-zinc-400">Ropa, altura, dirección de escape, vehículo. No saques el celular para filmar si te expone.</span></div>
                                </div>
                                <div className="flex gap-4">
                                    <div className="h-8 w-8 rounded-full bg-blue-500/20 text-blue-400 font-bold flex items-center justify-center shrink-0">3</div>
                                    <div><strong className="block text-white">Contené a la víctima</strong><span className="text-zinc-400">Cuando pase el peligro, acercate. Decile que no está sola. Ofrecele tu celular para llamar a familia.</span></div>
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/habla-sin-miedo" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Hablá Sin Miedo
                        </Link>
                        <Link to="/intel/prediccion-del-delito" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Predicción de Delito <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>
                </main>
            </div>
        </>
    );
}
