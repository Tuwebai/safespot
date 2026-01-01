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
                            Bienvenido/a a SafeSpot. Antes de utilizar nuestra plataforma, te solicitamos que leas detenidamente estos Términos y Condiciones. El acceso y uso de la aplicación implica tu aceptación total y sin reservas.
                        </p>
                    </section>

                    {/* Section 1: Nature of Service */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-neon-green/20 rounded-lg">
                                <MapPin className="h-5 w-5 text-neon-green" />
                            </div>
                            <h2 className="text-xl font-semibold">1. Naturaleza de la Plataforma</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                <strong>SafeSpot es una herramienta tecnológica de información colaborativa</strong> diseñada para el reporte y visualización de incidentes de seguridad comunitaria. No constituye un servicio de vigilancia, monitoreo profesional ni respuesta operativa.
                            </p>
                            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                                <p className="text-red-400 font-bold flex items-center gap-2 uppercase tracking-wide">
                                    <AlertTriangle className="h-4 w-4" />
                                    AVISO CRÍTICO DE SEGURIDAD
                                </p>
                                <p className="mt-2 text-foreground/90 font-medium">
                                    SafeSpot **NO REEMPLAZA** en ningún caso a las autoridades de seguridad pública (Policía, Gendarmería, etc.), servicios de emergencias médicas ni líneas oficiales (como el 911).
                                </p>
                                <p className="mt-2 text-sm text-foreground/70 italic">
                                    Ante una situación de riesgo inminente o emergencia real, el usuario tiene la obligación y responsabilidad de contactar de inmediato a las autoridades oficiales competentes.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Limitación de Responsabilidad */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Shield className="h-5 w-5 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold">2. Limitación de Responsabilidad</h2>
                        </div>
                        <div className="space-y-4 text-foreground/80">
                            <p>
                                El uso de SafeSpot se realiza bajo la exclusiva responsabilidad y cuenta del usuario.
                            </p>
                            <ul className="list-disc pl-5 space-y-3">
                                <li>
                                    <strong>Exactitud del Contenido:</strong> Los reportes son generados íntegramente por usuarios anónimos. SafeSpot no verifica de forma independiente la veracidad, exactitud, vigencia ni integridad de dicha información.
                                </li>
                                <li>
                                    <strong>Carácter Informativo:</strong> La información geolocalizada puede ser inexacta debido a limitaciones técnicas o errores de carga. No debe ser utilizada como única fuente para tomar decisiones de seguridad personal.
                                </li>
                                <li>
                                    <strong>Ausencia de Garantías:</strong> La plataforma se ofrece "tal cual es" (as-is). SafeSpot no asume responsabilidad por daños directos o indirectos derivados del uso indebido de la información o de fallos técnicos en la visualización de datos.
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 3: Uso Adecuado */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <Users className="h-5 w-5 text-purple-400" />
                            </div>
                            <h2 className="text-xl font-semibold">3. Reglas de la Comunidad</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>Al utilizar este servicio, te comprometes a:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>
                                    <strong>Prohibición de reportes falsos:</strong> No publicar información maliciosa o deliberadamente inexacta.
                                </li>
                                <li>
                                    <strong>Respeto y Legalidad:</strong> No utilizar la herramienta para actividades ilícitas, acoso, difamación o exposición de datos personales de terceros.
                                </li>
                                <li>
                                    <strong>Integridad del Sistema:</strong> No realizar acciones que comprometan la seguridad o disponibilidad de la infraestructura de SafeSpot.
                                </li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-4 italic">
                                El incumplimiento de estas normas facultará a SafeSpot para restringir el acceso del dispositivo infractor sin previo aviso.
                            </p>
                        </div>
                    </section>

                    {/* Section 4: Moderación y Propiedad */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <Shield className="h-5 w-5 text-orange-400" />
                            </div>
                            <h2 className="text-xl font-semibold">4. Control de Contenidos</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>Para proteger la integridad de la comunidad, SafeSpot se reserva el derecho unilatereal de:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Eliminar, editar o etiquetar como "dudoso" cualquier reporte que infrinja estos términos.</li>
                                <li>Implementar sistemas de filtrado automático de spam y contenido ofensivo.</li>
                                <li>Suspender el acceso a identificadores anónimos involucrados en comportamientos maliciosos persistentes.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 5: Jurisdicción y Validez */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-500/20 rounded-lg">
                                <Gavel className="h-5 w-5 text-red-400" />
                            </div>
                            <h2 className="text-xl font-semibold">5. Marco Legal</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                Estos términos se rigen por las leyes de la República Argentina y estándares internacionales de protección de servicios web. Cualquier conflicto será dirimido ante los tribunales competentes de la Ciudad Autónoma de Buenos Aires.
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
