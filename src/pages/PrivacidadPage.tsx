/**
 * Política de Privacidad - SafeSpot
 * 
 * Página legal sobre manejo de datos y anonimato.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Database, Lock, Shield } from 'lucide-react';

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
                        Última actualización: 11 de enero de 2026
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

                    {/* Section 1: Data Collection Types */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Database className="h-5 w-5 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold">1. Tipos de Datos que Recolectamos</h2>
                        </div>
                        <div className="space-y-4 text-foreground/80">
                            <p>
                                SafeSpot opera bajo un modelo híbrido que prioriza tu privacidad. La cantidad de datos recolectados depende de cómo decidas usar la aplicación:
                            </p>

                            <div className="grid md:grid-cols-2 gap-4 mt-4">
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h3 className="font-bold text-neon-green mb-2">A. Usuarios Anónimos (Por defecto)</h3>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>ID Anónimo:</strong> Cadena aleatoria generada en tu dispositivo (`anonymous_id`).</li>
                                        <li><strong>Geolocalización:</strong> Coordenadas (lat/long) únicamente al crear reportes.</li>
                                        <li><strong>Uso:</strong> No vinculamos esto a tu identidad real.</li>
                                    </ul>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h3 className="font-bold text-indigo-400 mb-2">B. Usuarios Autenticados (Google)</h3>
                                    <ul className="list-disc pl-5 space-y-1 text-sm">
                                        <li><strong>Datos de Google:</strong> Obtenemos tu dirección de correo electrónico, nombre y foto de perfil.</li>
                                        <li><strong>Identificador único:</strong> Tu ID de usuario de Google (`sub`) para recuperar tu cuenta.</li>
                                        <li><strong>Uso:</strong> Exclusivamente para sincronizar tu historial entre dispositivos.</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Google User Data Disclosure (Specific for Compliance) */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <Shield className="h-5 w-5 text-indigo-400" />
                            </div>
                            <h2 className="text-xl font-semibold">2. Uso de Datos de Usuario de Google</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                Si eliges iniciar sesión con Google ("Google Sign-In"), SafeSpot accede a la siguiente información autorizada por ti:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Dirección de Email:</strong> Usada únicamente como identificador único para que puedas recuperar tus reportes y logros si cambias de celular o reinstalas la app.</li>
                                <li><strong>Foto de Perfil y Nombre:</strong> Se muestran en tu perfil privado para confirmar que has iniciado sesión correctamente.</li>
                            </ul>
                            <div className="bg-indigo-500/10 border border-indigo-500/30 rounded-lg p-3 mt-4">
                                <p className="text-indigo-300 text-sm font-medium">
                                    <strong>Política de No-Comercialización:</strong> La información recibida de las APIs de Google se adhiere a la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white">Política de Datos de Usuario de los Servicios API de Google</a>, incluidos los requisitos de Uso Limitado. <strong>Nunca vendemos, compartimos ni utilizamos tus datos de Google para publicidad.</strong>
                                </p>
                            </div>
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
                            <h2 className="text-xl font-semibold">4. Tus Derechos</h2>
                        </div>
                        <div className="space-y-4 text-foreground/80">
                            <p>
                                Tienes derecho a eliminar tu cuenta y tus datos en cualquier momento.
                            </p>
                            <div className="bg-dark-bg p-4 rounded-lg border border-dark-border">
                                <p className="text-sm">
                                    Para solicitudes de eliminación de datos, escribe a:
                                    <span className="text-neon-green ml-1 font-mono">privacidad@safespot.tuweb-ai.com</span>
                                </p>
                            </div>
                        </div>
                    </section>
                </div>{/* End space-y-8 */}

                {/* Contact */}
                <section className="text-center py-8 border-t border-dark-border mt-8">
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
            </main>
        </div>
    );
}
