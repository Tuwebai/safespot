import { Link } from 'react-router-dom';
import { ArrowLeft, FileWarning, EyeOff, Lock, Server, CheckCircle2 } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function DenunciaPage() {
    return (
        <>
            <SEO
                title="Hablá Sin Miedo: Denuncias Anónimas Seguras"
                description="Hacé denuncias anónimas sobre venta de drogas o trata. SafeSpot protege tu identidad con arquitectura Cero-Knowledge. Tu seguridad es prioridad."
                keywords={['denuncia anonima', 'reportar drogas', 'trata', 'seguridad', 'anonimato', 'proteccion testigo']}
                url="https://safespot.tuweb-ai.com/intel/habla-sin-miedo"
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
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-300 text-sm font-semibold mb-6">
                            <FileWarning className="h-4 w-4" />
                            <span>Reportes Confidenciales</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Hablá Sin <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-400 to-white">Miedo</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            El silencio protege a los delincuentes. SafeSpot garantiza criptográficamente tu anonimato para que puedas alertar sobre delitos graves sin exponerte.
                        </p>
                    </div>

                    <div className="space-y-16">

                        {/* 1. Arquitectura de Anonimato */}
                        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-8 md:p-10">
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <EyeOff className="h-7 w-7 text-neon-green" />
                                ¿Cómo funciona el Anonimato?
                            </h2>
                            <p className="text-zinc-400 mb-8 leading-relaxed">
                                A diferencia de las redes sociales, <strong>SafeSpot desvincula tu identidad de tu reporte</strong>. Nuestra base de datos usa arquitectura Zero-Trust para reportes sensibles.
                            </p>

                            <div className="grid gap-6">
                                <div className="flex gap-4 p-4 border border-white/5 rounded-lg bg-black/20">
                                    <Lock className="h-6 w-6 text-neon-green shrink-0 mt-1" />
                                    <div>
                                        <strong className="block text-white">Sin Rastros de IP Pública</strong>
                                        <p className="text-sm text-zinc-500 mt-1">Nuestros logs de acceso rotan y se eliminan. No guardamos metadata que pueda triangular tu posición real más allá del punto del incidente.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4 p-4 border border-white/5 rounded-lg bg-black/20">
                                    <Server className="h-6 w-6 text-neon-green shrink-0 mt-1" />
                                    <div>
                                        <strong className="block text-white">Base de Datos Blindada</strong>
                                        <p className="text-sm text-zinc-500 mt-1">Los reportes anónimos se guardan sin referencia alguna al User ID. Técnicamente es imposible, incluso para nosotros, saber quién lo creó.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* 2. Qué Reportar */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <CheckCircle2 className="h-6 w-6 text-blue-400" />
                                ¿Qué situaciones reportar?
                            </h2>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-6 bg-zinc-900/50 rounded-xl border border-white/5">
                                    <h3 className="font-bold text-white mb-2">Venta de Drogas (Kioscos)</h3>
                                    <p className="text-sm text-zinc-400">Si identificás movimientos sospechosos constantes en una dirección. NO te acerques ni saques fotos obvias.</p>
                                </div>
                                <div className="p-6 bg-zinc-900/50 rounded-xl border border-white/5">
                                    <h3 className="font-bold text-white mb-2">Trata / Explotación</h3>
                                    <p className="text-sm text-zinc-400">Lugares con movimientos extraños en horarios nocturnos o situaciones de coacción visible.</p>
                                </div>
                                <div className="p-6 bg-zinc-900/50 rounded-xl border border-white/5">
                                    <h3 className="font-bold text-white mb-2">Desarmaderos</h3>
                                    <p className="text-sm text-zinc-400">Entrada y salida constante de autopartes o vehículos en mal estado en galpones privados.</p>
                                </div>
                                <div className="p-6 bg-zinc-900/50 rounded-xl border border-white/5">
                                    <h3 className="font-bold text-white mb-2">Robos Reiterados</h3>
                                    <p className="text-sm text-zinc-400">Si sabés que en esa esquina roban siempre, tu reporte ayuda a generar el "Mapa de Calor" para alertar a vecinos.</p>
                                </div>
                            </div>
                        </section>

                        {/* 3. CTA */}
                        <div className="text-center pt-8 border-t border-white/10">
                            <Link to="/crear-reporte" className="bg-white text-zinc-900 hover:bg-zinc-200 font-bold py-3 px-8 rounded-full shadow-lg transition-all">
                                Hacer Reporte Anónimo
                            </Link>
                        </div>

                    </div>

                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/violencia-de-genero" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Género
                        </Link>
                        <Link to="/intel/protocolo-testigo" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Protocolo Testigo <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
