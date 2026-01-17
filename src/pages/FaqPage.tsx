import { Link } from 'react-router-dom';
import { ArrowLeft, HelpCircle } from 'lucide-react';


export default function FaqPage() {
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
                    <h1 className="text-xl font-bold tracking-tight">Preguntas Frecuentes</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-16 max-w-3xl">

                <div className="text-center mb-16">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 mb-6">
                        <HelpCircle className="h-8 w-8 text-neon-green" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
                        ¿Cómo podemos <span className="text-neon-green">ayudarte</span>?
                    </h2>
                    <p className="text-zinc-400 text-lg">
                        Resolvemos las dudas más comunes sobre privacidad, seguridad y uso de SafeSpot.
                    </p>
                </div>

                <div className="space-y-4">
                    {/* Item 1 */}
                    <details className="group bg-zinc-900/30 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-zinc-100 hover:text-neon-green font-medium transition-colors">
                            <h3 className="text-base md:text-lg">¿SafeSpot es totalmente gratis?</h3>
                            <div className="shrink-0 transition duration-300 group-open:-rotate-180">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </summary>
                        <p className="mt-1 px-4 pb-4 text-zinc-400 leading-relaxed text-sm">
                            Sí, SafeSpot es una plataforma cívica 100% gratuita para la comunidad. No cobramos por reportar ni por recibir alertas. Nuestro objetivo es la seguridad comunitaria, no el lucro con la desgracia ajena.
                        </p>
                    </details>

                    {/* Item 2 */}
                    <details className="group bg-zinc-900/30 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-zinc-100 hover:text-neon-green font-medium transition-colors">
                            <h3 className="text-base md:text-lg">¿Quién puede ver mis reportes?</h3>
                            <div className="shrink-0 transition duration-300 group-open:-rotate-180">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </summary>
                        <p className="mt-1 px-4 pb-4 text-zinc-400 leading-relaxed text-sm">
                            Los reportes son públicos para la comunidad para cumplir la función de alerta, pero tu identidad personal está protegida. Los usuarios ven "qué" pasó y "dónde", pero no mostramos tu perfil completo ni datos de contacto directos a menos que tú decidas compartirlos en un chat privado.
                        </p>
                    </details>

                    {/* Item 3 */}
                    <details className="group bg-zinc-900/30 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-zinc-100 hover:text-neon-green font-medium transition-colors">
                            <h3 className="text-base md:text-lg">¿Qué pasa con los reportes falsos?</h3>
                            <div className="shrink-0 transition duration-300 group-open:-rotate-180">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </summary>
                        <p className="mt-1 px-4 pb-4 text-zinc-400 leading-relaxed text-sm">
                            SafeSpot usa un sistema de reputación y validación comunitaria. Si la comunidad detecta un reporte falso, puede marcarlo como sospechoso. Los usuarios con múltiples reportes falsos son bloqueados permanentemente (Shadowban).
                        </p>
                    </details>

                    {/* Item 4 */}
                    <details className="group bg-zinc-900/30 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-zinc-100 hover:text-neon-green font-medium transition-colors">
                            <h3 className="text-base md:text-lg">¿SafeSpot rastrea mi ubicación siempre?</h3>
                            <div className="shrink-0 transition duration-300 group-open:-rotate-180">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </summary>
                        <p className="mt-1 px-4 pb-4 text-zinc-400 leading-relaxed text-sm">
                            <strong>No.</strong> Solo accedemos a tu ubicación en dos momentos puntuales: cuando creas un reporte (para ubicarlo en el mapa) o cuando abres el mapa para ver reportes cercanos. No hay rastreo en segundo plano ni historial de movimientos.
                        </p>
                    </details>

                    {/* Item 5 */}
                    <details className="group bg-zinc-900/30 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-zinc-100 hover:text-neon-green font-medium transition-colors">
                            <h3 className="text-base md:text-lg">¿Qué hago si encuentro mi objeto?</h3>
                            <div className="shrink-0 transition duration-300 group-open:-rotate-180">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </summary>
                        <p className="mt-1 px-4 pb-4 text-zinc-400 leading-relaxed text-sm">
                            Felicitaciones! Puedes marcar tu reporte como "Resuelto" desde tu perfil. Esto es muy importante para dar esperanza a la comunidad y mantener el mapa limpio.
                        </p>
                    </details>

                    {/* Item 6 */}
                    <details className="group bg-zinc-900/30 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-zinc-100 hover:text-neon-green font-medium transition-colors">
                            <h3 className="text-base md:text-lg">¿Colaboran con la policía?</h3>
                            <div className="shrink-0 transition duration-300 group-open:-rotate-180">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </summary>
                        <p className="mt-1 px-4 pb-4 text-zinc-400 leading-relaxed text-sm">
                            SafeSpot es una herramienta independiente. Sin embargo, puedes exportar tu reporte de SafeSpot como evidencia complementaria al hacer tu denuncia formal. Recomendamos siempre hacer la denuncia policial oficial.
                        </p>
                    </details>

                    {/* Item 7 */}
                    <details className="group bg-zinc-900/30 border border-white/5 rounded-xl [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-1.5 p-4 text-zinc-100 hover:text-neon-green font-medium transition-colors">
                            <h3 className="text-base md:text-lg">¿Puedo usar SafeSpot sin notificaciones?</h3>
                            <div className="shrink-0 transition duration-300 group-open:-rotate-180">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </summary>
                        <p className="mt-1 px-4 pb-4 text-zinc-400 leading-relaxed text-sm">
                            Sí, puedes desactivarlas desde tu perfil. Sin embargo, la fuerza de SafeSpot radica en la velocidad de la comunidad. Recomendamos mantener las alertas de "Zona Cercana" activas.
                        </p>
                    </details>
                </div>

                <div className="mt-16 text-center pt-10 border-t border-white/5">
                    <p className="text-zinc-500 mb-4">¿No encontraste lo que buscabas?</p>
                    <a href="mailto:soporte@safespot.app" className="inline-flex items-center text-neon-green hover:underline">
                        Contactar Soporte
                    </a>
                </div>

            </main>
        </div>
    );
}
