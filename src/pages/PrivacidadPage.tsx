/**
 * Política de Privacidad - SafeSpot
 * 
 * Página legal sobre manejo de datos y anonimato.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Database, UserX, Lock, Shield } from 'lucide-react';

export default function PrivacidadPage() {
    return (
        <div className="min-h-screen bg-dark-bg">
            {/* Header */}
            <header className="sticky top-0 z-10 bg-zinc-950 border-b border-dark-border">
                <div className="container mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            to="/"
                            className="p-2 hover:bg-dark-bg rounded-lg transition-colors"
                        >
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                        <h1 className="text-xl font-bold">Política de Privacidad</h1>
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

                    {/* Promise Banner */}
                    <div className="bg-neon-green/10 border border-neon-green/30 rounded-xl p-6">
                        <div className="flex items-center gap-3 mb-3">
                            <Shield className="h-6 w-6 text-neon-green" />
                            <h2 className="text-lg font-semibold text-neon-green">Nuestro Compromiso</h2>
                        </div>
                        <p className="text-foreground/90">
                            SafeSpot está diseñado con la <strong>privacidad como prioridad</strong>.
                            No recolectamos datos personales, no requerimos registro, y tu identidad
                            permanece completamente anónima.
                        </p>
                    </div>

                    {/* Section 1: Data Collection & Minimization */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Database className="h-5 w-5 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold">1. Recolección Mínima de Datos</h2>
                        </div>
                        <div className="space-y-4 text-foreground/80">
                            <p>
                                De acuerdo con el principio de **minimización de datos**, SafeSpot solo solicita y almacena la información estrictamente necesaria para la prestación del servicio:
                            </p>
                            <div>
                                <h3 className="font-medium text-foreground mb-2 italic">Datos de Geolocalización:</h3>
                                <p className="text-sm mb-2">
                                    Al generar un reporte, procesamos las coordenadas exactas (latitud y longitud) para ubicar el incidente en el mapa. Estos datos se utilizan exclusivamente para informar a la comunidad sobre zonas de riesgo.
                                </p>
                            </div>
                            <ul className="list-disc pl-5 space-y-1">
                                <li>Contenido del reporte (categoría, descripción, fotos adjuntas).</li>
                                <li>Marca temporal del incidente.</li>
                                <li>Identificador Anónimo único del dispositivo.</li>
                            </ul>
                            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                                <p className="text-green-400 text-sm font-medium">
                                    SafeSpot NO vincula estos datos a nombres, correos electrónicos, números de teléfono ni identidades civiles reales.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Anonymous ID Transparency */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <UserX className="h-5 w-5 text-purple-400" />
                            </div>
                            <h2 className="text-xl font-semibold">2. Uso del Identificador Anónimo</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                El `anonymous_id` es una cadena de caracteres aleatoria generada localmente en tu dispositivo.
                            </p>
                            <div className="bg-dark-bg rounded-lg p-4 border border-dark-border space-y-2">
                                <h4 className="font-medium text-foreground">¿Para qué lo usamos?</h4>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li><strong>Prevención de Fraude:</strong> Evitar la saturación de reportes falsos desde un mismo origen.</li>
                                    <li><strong>Gestión de Usuario:</strong> Permitirte visualizar, editar o eliminar tus propios reportes sin necesidad de crear una cuenta con contraseña.</li>
                                    <li><strong>Seguridad:</strong> Mitigar ataques de denegación de servicio (DDoS) o spam malicioso.</li>
                                </ul>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Este identificador no nos permite conocer tu perfil personal ni rastrear tu actividad fuera de la aplicación.
                            </p>
                        </div>
                    </section>

                    {/* Section 3: No-Sells & No-Ads Policy */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <Lock className="h-5 w-5 text-green-400" />
                            </div>
                            <h2 className="text-xl font-semibold">3. Política de Terceros y Publicidad</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p className="font-medium text-foreground">Nuestro compromiso es absoluto:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>No vendemos ni alquilamos</strong> tus datos a empresas de marketing ni brokers de bases de datos.</li>
                                <li><strong>No utilizamos</strong> herramientas de publicidad personalizada o rastreadores de comportamiento (ads tracking).</li>
                                <li>Los datos de geolocalización no se comparten con anunciantes ni con redes sociales.</li>
                            </ul>
                        </div>
                    </section>

                    {/* Section 4: GDPR/LATAM Compliance & Rights */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-500/20 rounded-lg">
                                <Eye className="h-5 w-5 text-cyan-400" />
                            </div>
                            <h2 className="text-xl font-semibold">4. Tus Derechos y Eliminación de Datos</h2>
                        </div>
                        <div className="space-y-4 text-foreground/80">
                            <p>
                                Bajo normativas como el GDPR (Europa) y leyes de protección de datos locales en LATAM, tienes derecho a controlar tu información:
                            </p>
                            <div className="space-y-2">
                                <h4 className="font-medium text-foreground">Cómo ejercer tus derechos:</h4>
                                <ul className="list-disc pl-5 space-y-2">
                                    <li><strong>Eliminación Automática:</strong> Al borrar la caché y los datos del sitio en tu navegador, el identificador anónimo se destruye permanentemente en tu dispositivo.</li>
                                    <li><strong>Solicitud Manual:</strong> Si deseas que eliminemos un reporte específico o datos vinculados a tu identificador anónimo de nuestros servidores, puedes hacerlo por correo electrónico.</li>
                                </ul>
                            </div>
                            <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                                <p className="text-sm">
                                    Para solicitudes de eliminación de datos, escribe a:
                                    <span className="text-neon-green ml-1 font-mono">privacidad@safespot.tuweb-ai.com</span>
                                    <br />
                                    <span className="text-[10px] text-muted-foreground italic">Incluye tu identificador anónimo (si lo posees) o el detalle del reporte a remover.</span>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Contact */}
                    <section className="text-center py-8 border-t border-dark-border">
                        <p className="text-muted-foreground">
                            ¿Tenés preguntas sobre tu privacidad?
                        </p>
                        <a
                            href="mailto:privacidad@safespot.tuweb-ai.com"
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
