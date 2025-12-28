/**
 * Política de Privacidad - SafeSpot
 * 
 * Página legal sobre manejo de datos y anonimato.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Database, UserX, Lock, Server, Shield } from 'lucide-react';

export default function PrivacidadPage() {
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

                    {/* Section 1: What we collect */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-blue-500/20 rounded-lg">
                                <Database className="h-5 w-5 text-blue-400" />
                            </div>
                            <h2 className="text-xl font-semibold">1. Qué Datos Guardamos</h2>
                        </div>
                        <div className="space-y-4 text-foreground/80">
                            <div>
                                <h3 className="font-medium text-foreground mb-2">✅ Lo que SÍ guardamos:</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Contenido de los reportes que publicás (título, descripción, categoría)</li>
                                    <li>Ubicación geográfica del incidente (coordenadas)</li>
                                    <li>Fecha y hora del reporte</li>
                                    <li>Imágenes que subas voluntariamente</li>
                                    <li>Un identificador anónimo único (explicado abajo)</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground mb-2">❌ Lo que NO guardamos:</h3>
                                <ul className="list-disc pl-5 space-y-1">
                                    <li>Tu nombre real</li>
                                    <li>Tu email o teléfono</li>
                                    <li>Tu dirección IP de forma persistente</li>
                                    <li>Historial de ubicaciones</li>
                                    <li>Ningún dato que pueda identificarte personalmente</li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Anonymous ID */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-purple-500/20 rounded-lg">
                                <UserX className="h-5 w-5 text-purple-400" />
                            </div>
                            <h2 className="text-xl font-semibold">2. Identificador Anónimo</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                Para prevenir abusos y permitir funcionalidades básicas, generamos un
                                <strong> identificador anónimo único</strong> que se almacena solo en tu dispositivo.
                            </p>
                            <div className="bg-dark-bg rounded-lg p-4 border border-dark-border">
                                <h4 className="font-medium mb-2">¿Qué es el identificador anónimo?</h4>
                                <ul className="list-disc pl-5 space-y-1 text-sm">
                                    <li>Es un código aleatorio generado en tu navegador</li>
                                    <li><strong>NO está vinculado a tu identidad real</strong></li>
                                    <li>NO podemos saber quién sos a partir de este código</li>
                                    <li>Si borrás los datos del navegador, se genera uno nuevo</li>
                                </ul>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Este identificador nos permite saber que varios reportes fueron hechos
                                desde el mismo dispositivo (para prevenir spam), pero nunca quién los hizo.
                            </p>
                        </div>
                    </section>

                    {/* Section 3: No Third Parties */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-green-500/20 rounded-lg">
                                <Lock className="h-5 w-5 text-green-400" />
                            </div>
                            <h2 className="text-xl font-semibold">3. No Compartimos tus Datos</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                <strong>No vendemos, alquilamos ni compartimos</strong> ningún dato con terceros.
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>No usamos servicios de publicidad que rastreen usuarios</li>
                                <li>No enviamos datos a redes sociales</li>
                                <li>No compartimos información con gobiernos ni empresas privadas</li>
                            </ul>
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mt-4">
                                <p className="text-yellow-400 text-sm">
                                    <strong>Excepción legal:</strong> Solo revelaríamos información si nos lo
                                    exigiera una orden judicial válida emitida por un tribunal argentino,
                                    y en ese caso solo podríamos entregar el identificador anónimo y el
                                    contenido público del reporte.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Section 4: Anti-fraud */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-orange-500/20 rounded-lg">
                                <Server className="h-5 w-5 text-orange-400" />
                            </div>
                            <h2 className="text-xl font-semibold">4. Uso para Moderación</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>
                                Utilizamos el identificador anónimo internamente para:
                            </p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>Detectar y prevenir reportes spam o abusivos</li>
                                <li>Limitar la cantidad de reportes por dispositivo</li>
                                <li>Aplicar restricciones a usuarios que infrinjan las normas</li>
                                <li>Permitir que veas y edites tus propios reportes</li>
                            </ul>
                            <p className="text-sm text-muted-foreground mt-4">
                                Estas medidas protegen la calidad de la comunidad sin comprometer tu privacidad.
                            </p>
                        </div>
                    </section>

                    {/* Section 5: Your Rights */}
                    <section className="bg-dark-card rounded-xl p-6 border border-dark-border">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-500/20 rounded-lg">
                                <Eye className="h-5 w-5 text-cyan-400" />
                            </div>
                            <h2 className="text-xl font-semibold">5. Tus Derechos</h2>
                        </div>
                        <div className="space-y-3 text-foreground/80">
                            <p>Tenés derecho a:</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Borrar tu historial:</strong> Limpiá los datos del navegador para generar un nuevo identificador</li>
                                <li><strong>No ser rastreado:</strong> No usamos cookies de tracking</li>
                                <li><strong>Usar la app sin identificarte:</strong> Nunca te pediremos datos personales</li>
                            </ul>
                        </div>
                    </section>

                    {/* Contact */}
                    <section className="text-center py-8 border-t border-dark-border">
                        <p className="text-muted-foreground">
                            ¿Tenés preguntas sobre tu privacidad?
                        </p>
                        <a
                            href="mailto:privacidad@safespot.app"
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
