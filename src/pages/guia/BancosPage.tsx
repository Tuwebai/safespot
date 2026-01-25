import { Link } from 'react-router-dom';
import { ArrowLeft, Landmark, CreditCard, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function BancosPage() {
    return (
        <>
            <SEO
                title="Ojo en el Cajero: Seguridad Bancaria"
                description="Prevención de salideras y clonación de tarjetas. Cómo detectar skimmers en cajeros automáticos y actuar de forma segura."
                keywords={['cajero automatico', 'banco', 'salidera', 'skimmer', 'clonacion tarjetas', 'seguridad bancaria']}
                url="https://safespot.tuweb-ai.com/intel/ojo-en-el-cajero"
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
                            <Landmark className="h-4 w-4" />
                            <span>Operaciones Financieras</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Ojo en el <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-green-600">Cajero</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            El momento de sacar efectivo es crítico. Rutas de escape, cómo detectar marcadores y qué hacer si ves algo raro en la ranura.
                        </p>
                    </div>

                    <div className="space-y-16">

                        {/* 1. Skimmers */}
                        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-8 md:p-10 relative">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent opacity-50"></div>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <CreditCard className="h-7 w-7 text-emerald-400" />
                                El Cajero Adulterado (Skimmer)
                            </h2>
                            <p className="text-zinc-400 mb-6">
                                Los delincuentes instalan dispositivos para clonar tu tarjeta y leer tu PIN. Antes de meter la tarjeta, hacé el test de fuerza:
                            </p>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-black/40 p-5 rounded-xl border border-white/5 hover:border-emerald-500/40 transition-all">
                                    <strong className="block text-white mb-2 text-lg">1. Boquilla Floja</strong>
                                    <span className="text-sm text-zinc-400">Agarrá la ranura donde entra la tarjeta y movela con fuerza. Si se mueve, está floja o tiene algo pegado: <strong>NO la uses.</strong></span>
                                </div>
                                <div className="bg-black/40 p-5 rounded-xl border border-white/5 hover:border-emerald-500/40 transition-all">
                                    <strong className="block text-white mb-2 text-lg">2. Teclado Falso</strong>
                                    <span className="text-sm text-zinc-400">Mová el teclado. A veces ponen uno falso encima del original para grabar qué apretás. Si sentís relieve extraño, andate.</span>
                                </div>
                            </div>
                        </section>

                        {/* 2. Salideras */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <EyeOff className="h-6 w-6 text-emerald-400" />
                                Anti-Salidera Bancaria
                            </h2>
                            <div className="bg-zinc-900/30 p-8 rounded-2xl border border-dashed border-white/10">
                                <ul className="space-y-6">
                                    <li className="flex gap-4">
                                        <AlertCircle className="h-6 w-6 text-emerald-500 shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-white">Detectá al "Marcador"</h3>
                                            <p className="text-zinc-400 text-sm mt-1">
                                                Adentro del banco, mirá a tu alrededor. Si ves a alguien que no hace fila, usa el celular constantemente y te mira, alertá a seguridad.
                                            </p>
                                        </div>
                                    </li>
                                    <li className="flex gap-4">
                                        <ShieldCheck className="h-6 w-6 text-emerald-500 shrink-0" />
                                        <div>
                                            <h3 className="font-bold text-white">Ruta Impredecible</h3>
                                            <p className="text-zinc-400 text-sm mt-1">
                                                Si sacás mucha plata, no vuelvas directo a casa por el camino de siempre. Tomá un taxi dentro de una zona segura o cambiá la rutina.
                                            </p>
                                        </div>
                                    </li>
                                </ul>
                            </div>
                        </section>

                        {/* 3. Acción */}
                        <div className="flex flex-col items-center justify-center pt-8 border-t border-white/10">
                            <p className="text-zinc-400 mb-6 text-center">
                                SafeSpot permite reportar cajeros sospechosos o zonas de alta frecuencia de salideras.
                            </p>
                            <Link to="/crear-reporte" className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-emerald-600/20 transition-all">
                                Reportar Zona Peligrosa
                            </Link>
                        </div>

                    </div>

                    {/* Footer Nav */}
                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <Link to="/intel/viaja-pillo-transporte" className="hover:text-white transition-colors flex items-center gap-2">
                            <ArrowLeft className="h-4 w-4" /> Anterior: Transporte
                        </Link>
                        <Link to="/intel/perdiste-al-firu" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Mascotas <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
