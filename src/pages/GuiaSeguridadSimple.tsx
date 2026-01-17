import { Link } from 'react-router-dom';
import { ArrowLeft, BookOpen, Eye, ShieldCheck, HeartHandshake, UserX } from 'lucide-react';

export default function GuiaSeguridadSimple() {
    return (
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
                    <h1 className="text-xl font-bold tracking-tight">Guía de Seguridad Comunitaria</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-16 max-w-4xl">

                {/* Header */}
                <div className="mb-16">
                    <div className="flex items-center gap-3 mb-6">
                        <BookOpen className="h-8 w-8 text-neon-green" />
                        <h2 className="text-3xl font-bold text-white">Reglas de Convivencia</h2>
                    </div>
                    <p className="text-xl text-zinc-400 leading-relaxed border-l-4 border-neon-green pl-6">
                        SafeSpot es una herramienta de <strong>colaboración, no de confrontación</strong>. Entiende que tu seguridad personal es siempre la prioridad absoluta. Ningún objeto vale tu integridad física.
                    </p>
                </div>

                <div className="grid md:grid-cols-2 gap-12">

                    {/* Columna 1: Buenas Prácticas */}
                    <div className="space-y-12">
                        <section>
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <ShieldCheck className="h-5 w-5 text-emerald-500" />
                                Lo que SÍ debes hacer
                            </h3>
                            <ul className="space-y-6">
                                <li className="bg-zinc-900/50 p-5 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                                    <strong className="block text-emerald-400 mb-1">Verifica antes de reportar</strong>
                                    <p className="text-zinc-400 text-sm">Asegúrate de que el objeto realmente fue robado y no extraviado. La credibilidad de la red depende de la calidad de los reportes.</p>
                                </li>
                                <li className="bg-zinc-900/50 p-5 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                                    <strong className="block text-emerald-400 mb-1">Sé descriptivo</strong>
                                    <p className="text-zinc-400 text-sm">"Bici negra" no ayuda. "Bicicleta Trek negra con calcomanía de Star Wars en el cuadro" ayuda a toda la comunidad a identificarla.</p>
                                </li>
                                <li className="bg-zinc-900/50 p-5 rounded-xl border border-white/5 hover:border-emerald-500/30 transition-colors">
                                    <strong className="block text-emerald-400 mb-1">Respeto en el chat</strong>
                                    <p className="text-zinc-400 text-sm">Los comentarios están para aportar datos, no para juzgar a la víctima ni para emitir opiniones políticas o sociales.</p>
                                </li>
                            </ul>
                        </section>
                    </div>

                    {/* Columna 2: Lo que NO hacer */}
                    <div className="space-y-12">
                        <section>
                            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                                <UserX className="h-5 w-5 text-red-500" />
                                Lo que NUNCA debes hacer
                            </h3>
                            <ul className="space-y-6">
                                <li className="bg-zinc-900/50 p-5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                    <strong className="block text-red-400 mb-1">No confrontar sospechosos</strong>
                                    <p className="text-zinc-400 text-sm">Si ves un objeto robado, <strong>no intervengas</strong>. Trea de mantener distancia, reporta el avistamiento en la app y llama a la policía.</p>
                                </li>
                                <li className="bg-zinc-900/50 p-5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                    <strong className="block text-red-400 mb-1">No compartir datos sensibles</strong>
                                    <p className="text-zinc-400 text-sm">Nunca publiques tu dirección exacta de casa ni tu teléfono en los comentarios públicos del reporte.</p>
                                </li>
                                <li className="bg-zinc-900/50 p-5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                    <strong className="block text-red-400 mb-1">Sin difamación</strong>
                                    <p className="text-zinc-400 text-sm">No acuses a personas específicas con nombre y apellido sin pruebas judiciales. SafeSpot es para localizar objetos, no para escrachar personas.</p>
                                </li>
                            </ul>
                        </section>
                    </div>
                </div>

                <div className="my-16 border-t border-white/10"></div>

                {/* Avistamientos */}
                <section className="bg-zinc-900 border border-white/10 rounded-2xl p-8 mb-16">
                    <div className="flex items-start gap-6">
                        <div className="p-3 bg-blue-500/10 rounded-lg hidden md:block">
                            <Eye className="h-8 w-8 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="text-2xl font-bold text-white mb-4">Protocolo de Avistamientos Responsables</h3>
                            <p className="text-zinc-300 mb-6">
                                Ver un objeto robado es el momento clave de SafeSpot. Actúa con inteligencia:
                            </p>
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-white text-sm uppercase tracking-wider opacity-80">Qué reportar</h4>
                                    <ul className="text-sm text-zinc-400 space-y-2 list-disc pl-4">
                                        <li>Ubicación exacta (Calle y altura)</li>
                                        <li>Dirección de movimiento (Hacia dónde iba)</li>
                                        <li>Hora exacta del avistamiento</li>
                                    </ul>
                                </div>
                                <div className="space-y-2">
                                    <h4 className="font-semibold text-white text-sm uppercase tracking-wider opacity-80">Qué NO reportar</h4>
                                    <ul className="text-sm text-zinc-400 space-y-2 list-disc pl-4">
                                        <li>Suposiciones ("tenía cara de ladrón")</li>
                                        <li>Información falsa para "bromear"</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer Section */}
                <section className="text-center bg-gradient-to-b from-transparent to-neon-green/5 rounded-3xl p-10 border border-white/5">
                    <HeartHandshake className="h-12 w-12 text-neon-green mx-auto mb-6" />
                    <h3 className="text-2xl font-bold text-white mb-2">Responsabilidad Compartida</h3>
                    <p className="text-zinc-400 max-w-2xl mx-auto">
                        SafeSpot funciona porque confiamos en que, en el fondo, la mayoría de las personas queremos vivir en una comunidad segura. Cuida la red, y la red te cuidará a ti.
                    </p>
                </section>

            </main>
        </div>
    );
}
