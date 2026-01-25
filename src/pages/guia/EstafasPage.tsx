import { Link } from 'react-router-dom';
import { ArrowLeft, Smartphone, ShieldAlert, Lock, AlertTriangle } from 'lucide-react';
import { SEO } from '@/components/SEO';

export default function EstafasPage() {
    return (
        <>
            <SEO
                title="Cuento del Tío 2.0: Estafas Virtuales y Phishing"
                description="Guía anti-estafas digitales. Cómo detectar phishing, falsos soportes técnicos y estafas en Marketplace. Protegés tus datos bancarios hoy."
                keywords={['estafas', 'phishing', 'ciberdelito', 'seguridad bancaria', 'cuento del tio']}
                url="https://safespot.tuweb-ai.com/intel/cuento-del-tio-ciberdelito"
            />
            <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-neon-green/30">
                {/* Sticky Header */}
                <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/5">
                    <div className="container mx-auto px-4 py-4 flex items-center gap-4">
                        <Link
                            to="/"
                            className="p-2 hover:bg-white/5 rounded-full transition-colors group"
                            aria-label="Volver al inicio"
                        >
                            <ArrowLeft className="h-5 w-5 text-gray-400 group-hover:text-white transition-colors" />
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight">Centro de Inteligencia</h1>
                    </div>
                </header>

                <main className="container mx-auto px-4 py-16 max-w-4xl">

                    {/* Hero Section */}
                    <div className="text-center mb-20">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold mb-6">
                            <ShieldAlert className="h-4 w-4" />
                            <span>Alerta Ciberdelito</span>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                            Cuento del Tío <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-600">2.0</span>
                        </h1>
                        <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                            Los estafadores ya no tocan timbre. Te entran por WhatsApp, Instagram y mails falsos. Aprendé a blindarte digitalmente hoy mismo.
                        </p>
                    </div>

                    <div className="space-y-16">

                        {/* 1. Contexto */}
                        <section className="bg-zinc-900 border border-white/10 rounded-2xl p-8 md:p-10 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-32 bg-red-500/5 blur-3xl -z-10 rounded-full"></div>
                            <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <Smartphone className="h-7 w-7 text-red-500" />
                                El Nuevo "Verso" Digital
                            </h2>
                            <p className="text-zinc-400 leading-relaxed mb-6">
                                La ingeniería social evolucionó. Ya no buscan solo abuelos; buscan <strong>descuidados</strong>. Usan la urgencia ("tu cuenta fue bloqueada") o la codicia ("ganaste un premio") para que entregues tu clave o token.
                            </p>
                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="bg-black/40 p-5 rounded-xl border-l-4 border-red-500">
                                    <strong className="block text-white mb-1">El Falso Soporte</strong>
                                    <span className="text-sm text-zinc-400">Te llaman de "Tu Banco" o "WhatsApp" pidiendo el código que te acaba de llegar por SMS. <strong>NUNCA entregues ese código.</strong></span>
                                </div>
                                <div className="bg-black/40 p-5 rounded-xl border-l-4 border-orange-500">
                                    <strong className="block text-white mb-1">Venta Marketplace</strong>
                                    <span className="text-sm text-zinc-400">Te quieren comprar algo y te piden ir al cajero para "generar la clave token" o te mandan un comprobante de transferencia trucho.</span>
                                </div>
                            </div>
                        </section>

                        {/* 2. Modus Operandi */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <AlertTriangle className="h-6 w-6 text-orange-400" />
                                Señales de Alerta Inmediata
                            </h2>
                            <div className="grid md:grid-cols-3 gap-6">
                                <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                    <h3 className="font-semibold text-white mb-2 text-lg">Urgencia</h3>
                                    <p className="text-sm text-zinc-400">
                                        "Tenés 10 minutos para validar tu identidad o cerramos la cuenta". Si te apuran, es estafa. Cortá.
                                    </p>
                                </div>
                                <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                    <h3 className="font-semibold text-white mb-2 text-lg">Fuera de Canal</h3>
                                    <p className="text-sm text-zinc-400">
                                        Te contactan por WhatsApp con logo de empresa pero número de celular común (11...). Las empresas usan cuentas verificadas.
                                    </p>
                                </div>
                                <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                    <h3 className="font-semibold text-white mb-2 text-lg">El "Regalo"</h3>
                                    <p className="text-sm text-zinc-400">
                                        Nadie regala nada. Si es demasiado bueno para ser verdad (iPhone a mitad de precio, bono del gobierno), es mentira.
                                    </p>
                                </div>
                            </div>
                        </section>

                        {/* 3. Protocolo de Acción */}
                        <section>
                            <h2 className="text-2xl font-bold mb-8 flex items-center gap-3">
                                <Lock className="h-6 w-6 text-emerald-400" />
                                ¿Te pasó? Protocolo de Rescate
                            </h2>
                            <div className="bg-gradient-to-r from-zinc-900 to-zinc-900/50 border border-white/10 rounded-2xl p-8">
                                <ul className="space-y-6">
                                    <li className="flex gap-4">
                                        <div className="h-8 w-8 rounded-full bg-red-500/20 flex items-center justify-center shrink-0 text-red-400 font-bold">1</div>
                                        <div>
                                            <strong className="block text-white text-lg">Cortá Toda Comunicación</strong>
                                            <span className="text-zinc-400">Bloqueá el número. No intentes "negociar" ni insultar. Ellos buscan sacar más datos.</span>
                                        </div>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="h-8 w-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0 text-orange-400 font-bold">2</div>
                                        <div>
                                            <strong className="block text-white text-lg">Avisá al Banco / Plataforma</strong>
                                            <span className="text-zinc-400">Llamá a los números oficiales (al dorso de la tarjeta). Pedí el "Stop Debit" si diste datos bancarios.</span>
                                        </div>
                                    </li>
                                    <li className="flex gap-4">
                                        <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 text-emerald-400 font-bold">3</div>
                                        <div>
                                            <strong className="block text-white text-lg">Reportá en SafeSpot</strong>
                                            <span className="text-zinc-400">Ayudá a otros. Creá un reporte de "Actividad Sospechosa" detallando el número o método usado.</span>
                                        </div>
                                    </li>
                                </ul>

                                <div className="mt-8 pt-8 border-t border-white/10 flex justify-center">
                                    <Link to="/crear-reporte" className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-full shadow-lg shadow-red-600/20 transition-all transform hover:scale-105">
                                        Reportar Intento de Estafa
                                    </Link>
                                </div>
                            </div>
                        </section>

                    </div>

                    {/* Footer Navigation */}
                    <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                        <p>© SafeSpot Intel</p>
                        <Link to="/intel/viaja-pillo-transporte" className="hover:text-white transition-colors flex items-center gap-2">
                            Siguiente: Viajá Pillo <ArrowLeft className="h-4 w-4 rotate-180" />
                        </Link>
                    </div>

                </main>
            </div>
        </>
    );
}
