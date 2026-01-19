/**
 * Términos y Condiciones - SafeSpot
 * 
 * Marco legal detallado para el uso de la plataforma.
 * Incluye Código de Conducta, Limitación de Responsabilidad y Propiedad Intelectual.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, Users, Gavel, FileText, Ban } from 'lucide-react';

export default function TerminosPage() {
    return (
        <div className="min-h-screen bg-dark-bg text-foreground font-sans">
            {/* Header Sticky */}
            <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-white/5">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="p-2 hover:bg-white/5 rounded-full transition-colors"
                            aria-label="Volver al inicio"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h1 className="text-xl font-bold tracking-tight">Términos y Condiciones</h1>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-12 max-w-4xl">

                {/* Last Updated */}
                <div className="mb-12 text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                        Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                        Reglas de Juego Claras.
                    </h2>
                    <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
                        SafeSpot es una herramienta comunitaria poderosa. Para que funcione para todos, necesitamos compromiso y responsabilidad.
                    </p>
                </div>

                <div className="space-y-12">

                    {/* 1. Naturaleza de la Plataforma (Critical Disclaimer) */}
                    <section className="bg-dark-card rounded-2xl p-8 border border-white/5 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-neon-green/10 rounded-lg">
                                <AlertTriangle className="h-6 w-6 text-neon-green" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">1. Aviso Crítico de Seguridad</h2>
                        </div>
                        <div className="space-y-4 text-foreground/90 leading-relaxed">
                            <p className="font-medium text-lg">
                                SafeSpot es una herramienta de <strong>información colaborativa</strong> ("Crowdsourcing").
                            </p>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                                <strong className="text-red-400 block mb-2 uppercase tracking-wider text-sm">Importante</strong>
                                <p className="text-white">
                                    SafeSpot <strong>NO ES UN SERVICIO DE EMERGENCIA</strong>. No reemplaza al 911, a la policía ni a los servicios médicos.
                                </p>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    Si estás en peligro inmediato, llama a las autoridades locales. No confíes tu seguridad física exclusivamente a esta aplicación.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 2. Cuentas y Registro (NEW SECTION) */}
                    <section className="bg-white/5 rounded-2xl p-8 border border-white/5">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Shield className="h-6 w-6 text-neon-green" />
                            2. Cuentas y Autenticación
                        </h2>
                        <div className="space-y-4 text-muted-foreground">
                            <p>
                                SafeSpot opera bajo un modelo de confianza verificado:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Modo Invitado:</strong> Puedes visualizar información pública sin crear una cuenta.</li>
                                <li><strong>Modo Colaborador:</strong> Para <strong>crear reportes, comentar o validar alertas</strong>, es OBLIGATORIO registrarse/iniciar sesión. Esto nos permite mantener la calidad de los datos y evitar el spam automatizado.</li>
                            </ul>
                            <p className="mt-4 text-sm bg-white/5 p-4 rounded-lg">
                                <strong>Responsabilidad de la Cuenta:</strong> Eres responsable de mantener la seguridad de tus credenciales. Cualquier actividad realizada desde tu cuenta se presume realizada por ti.
                            </p>
                        </div>
                    </section>

                    {/* 3. Código de Conducta (Renumbered) */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Users className="h-6 w-6 text-blue-400" />
                            3. Código de Conducta y Uso Aceptable
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Nos reservamos el derecho de <strong>bloquear permanentemente</strong> (Shadowban o Ban) a usuarios que violen estas reglas fundamentales:
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                                    <Ban className="h-4 w-4" />
                                    <span>Reportes Falsos</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Crear incidentes inexistentes para generar pánico, bromear o manipular estadísticas de la zona.
                                </p>
                            </div>
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                                    <Ban className="h-4 w-4" />
                                    <span>Discurso de Odio</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Comentarios racistas, xenófobos, discriminatorios o violentos en reportes o chats.
                                </p>
                            </div>
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                                    <Ban className="h-4 w-4" />
                                    <span>Spam o Venta</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Usar la plataforma para promocionar servicios, vender productos, estafas o enlaces externos.
                                </p>
                            </div>
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5 hover:border-red-500/30 transition-colors">
                                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                                    <Ban className="h-4 w-4" />
                                    <span>Doxing</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Publicar información privada de terceros (DNI, direcciones exactas de víctimas, caras claras).
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 4. Limitación de Responsabilidad (Renumbered) */}
                    <section className="bg-white/5 rounded-2xl p-8 border border-white/5">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <AlertTriangle className="h-6 w-6 text-yellow-500" />
                            4. Limitación de Responsabilidad
                        </h2>
                        <ul className="space-y-4 text-muted-foreground text-sm">
                            <li className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-white/30 mt-2 shrink-0"></div>
                                <p><strong>Veracidad de Datos:</strong> SafeSpot no verifica cada reporte en tiempo real. La información es generada por usuarios y puede contener errores.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-white/30 mt-2 shrink-0"></div>
                                <p><strong>Interrupciones:</strong> No garantizamos que el servicio sea ininterrumpido. Realizamos mantenimiento periódico.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-white/30 mt-2 shrink-0"></div>
                                <p><strong>Uso "As-Is":</strong> La plataforma se ofrece tal cual es. El uso de la información para transitar por zonas peligrosas es bajo tu propio riesgo.</p>
                            </li>
                            <li className="flex gap-3">
                                <div className="h-1.5 w-1.5 rounded-full bg-white/30 mt-2 shrink-0"></div>
                                <p><strong>Datos sin Cuenta:</strong> SafeSpot NO garantiza la persistencia o accesibilidad de datos generados en "Modo Invitado" (si aplicara temporalmente) si el usuario cambia de dispositivo o borra cookies.</p>
                            </li>
                        </ul>
                    </section>

                    {/* 5. Propiedad Intelectual (Renumbered) */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <FileText className="h-6 w-6 text-purple-400" />
                            5. Propiedad Intelectual y Licencia
                        </h2>
                        <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                            Al subir contenido a SafeSpot (textos, fotos, ubicaciones), otorgas a la plataforma una licencia mundial, no exclusiva y libre de regalías para visualizar, distribuir y agregar dicha información en mapas de calor y estadísticas de seguridad.
                        </p>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                            SafeSpot se compromete a mantener estos datos agregados como un bien público para la seguridad de la comunidad (Open Data initiatives), respetando siempre el anonimato de la fuente.
                        </p>
                    </section>

                    {/* 6. Jurisdicción (Renumbered) */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Gavel className="h-6 w-6 text-gray-400" />
                            6. Jurisdicción y Ley Aplicable
                        </h2>
                        <p className="text-muted-foreground text-sm">
                            Estos términos se rigen por las leyes vigentes en la República Argentina. Cualquier disputa será resuelta en los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires, renunciando a cualquier otro fuero o jurisdicción.
                        </p>
                    </section>

                </div>

                {/* Footer Contact */}
                <div className="border-t border-white/10 pt-12 mt-12 text-center">
                    <p className="text-muted-foreground mb-2">
                        ¿Dudas sobre las reglas?
                    </p>
                    <a href="mailto:legal@safespot.tuweb-ai.com" className="text-neon-green font-medium hover:underline">
                        Contactar a Soporte Legal
                    </a>
                </div>

            </main>
        </div>
    );
}
