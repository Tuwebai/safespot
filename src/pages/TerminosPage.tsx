/**
 * Términos y Condiciones - SafeSpot
 * 
 * Página legal con términos de uso de la plataforma.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Shield, AlertTriangle, Users, Gavel, MapPin } from 'lucide-react';

export default function TerminosPage() {
    return (
        <div className="min-h-screen bg-dark-bg">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-dark-card/95 backdrop-blur border-b border-dark-border">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h1 className="text-xl font-bold">Términos y Condiciones</h1>
                    </div>
                </div>
            </header>

            {/* Content */}
            <main className="container mx-auto px-4 py-8 max-w-3xl">
                <div className="space-y-8">

                    {/* Last Updated */}
                    <p className="text-sm text-muted-foreground">
                        Última actualización: 28 de diciembre de 2024
                    </p>

                    {/* Intro */}
                    <section className="prose prose-invert max-w-none">
                        <p className="text-lg text-foreground/90 leading-relaxed">
                            Bienvenido/a a SafeSpot. Al usar esta plataforma, aceptás los siguientes
                            términos y condiciones. Te pedimos que los leas con atención.
                        </p>
                    </section>

                    {/* Section 1: Nature of Service */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-neon-green/20 rounded-lg">
                                <MapPin className="h-5 w-5 text-neon-green" />
                            </div>
                            <h2 className="text-xl font-semibold">1. Naturaleza del Servicio</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                <strong>SafeSpot es una plataforma informativa y comunitaria</strong> que permite
                                a los usuarios compartir reportes sobre incidentes de seguridad urbana de manera anónima.
                            </p>
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                                <p className="text-yellow-400 font-medium flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4" />
                                    Importante
                                </p>
                                <p className="mt-2 text-foreground/70">
                                    SafeSpot <strong>NO reemplaza</strong> denuncias policiales oficiales, llamados
                                    de emergencia al 911, ni ningún otro mecanismo formal de seguridad pública.
                                    Ante una emergencia real, siempre contactá a las autoridades correspondientes.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Limitation of Liability */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Shield className="h-5 w-5 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold">2. Limitación de Responsabilidad</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                Los reportes publicados en SafeSpot son generados por usuarios de la comunidad.
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <strong>No garantizamos la veracidad, exactitud o actualidad</strong> de la
                                    información publicada por los usuarios.
                                </li>
                                <li>
                                    SafeSpot <strong>no se hace responsable</strong> por decisiones que tomes
                                    basándote en la información de esta plataforma.
                                </li>
                                <li>
                                    La plataforma se ofrece "tal cual está", sin garantías de ningún tipo.
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 3: Acceptable Use */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Users className="h-5 w-5 text-purple-400" />
                            </div>
                            <h2 className="text-xl font-semibold">3. Uso Adecuado</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>Al usar SafeSpot, te comprometés a:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <strong>No publicar reportes falsos, maliciosos o difamatorios</strong> con
                                    intención de engañar o perjudicar a terceros.
                                </li>
                                <li>
                                    No utilizar la plataforma para acosar, amenazar o discriminar.
                                </li>
                                <li>
                                    Reportar únicamente incidentes que hayas presenciado o tengas conocimiento
                                    directo de su ocurrencia.
                                </li>
                                <li>
                                    No intentar identificar o revelar la identidad de otros usuarios.
                                </li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-4">
                                El incumplimiento de estas reglas puede resultar en restricciones de uso sin previo aviso.
                            </p>
                        </div>
                    </section>

                    {/* Section 4: Moderation */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <Shield className="h-5 w-5 text-orange-400" />
                            </div>
                            <h2 className="text-xl font-semibold">4. Moderación</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>SafeSpot se reserva el derecho de:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <strong>Ocultar, modificar o eliminar</strong> cualquier contenido que
                                    infrinja estos términos o que consideremos inapropiado.
                                </li>
                                <li>
                                    <strong>Limitar o restringir</strong> el acceso de usuarios que abusen de la plataforma.
                                </li>
                                <li>
                                    Implementar sistemas automatizados de moderación para proteger la comunidad.
                                </li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-4">
                                Estas acciones pueden realizarse sin notificación previa para proteger
                                la integridad de la plataforma y sus usuarios.
                            </p>
                        </div>
                    </section>

                    {/* Section 5: Jurisdiction */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded-lg">
                                <Gavel className="h-5 w-5 text-red-400" />
                            </div>
                            <h2 className="text-xl font-semibold">5. Jurisdicción</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                Estos términos se rigen por las leyes de la <strong>República Argentina</strong>.
                            </p>
                            <p>
                                Cualquier controversia que surja del uso de SafeSpot será sometida a la
                                jurisdicción de los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.
                            </p>
                        </div>
                    </section>

                    {/* Contact */}
                    <section className="text-center py-8 border-t border-dark-border">
                        <p className="text-muted-foreground">
                            ¿Tenés alguna consulta sobre estos términos?
                        </p>
                        <a
                            href="mailto:legal@safespot.app"
                            className="text-neon-green hover:underline"
                        >
                            Contactanos
                        </a>
                    </section>

                </div>
            </main>
        </div>
    );
}
