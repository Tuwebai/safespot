/**
 * Sobre Nosotros / Nuestra Misión - SafeSpot
 * 
 * Página institucional que define qué es SafeSpot, su misión y limitaciones legales.
 * Última actualización: {new Date().toLocaleDateString()}
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Users, Eye, Shield, AlertTriangle, Heart, CheckCircle, XCircle } from 'lucide-react';

export default function AboutPage() {
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
                        <h1 className="text-xl font-bold tracking-tight">Sobre Nosotros</h1>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-12 max-w-4xl">

                {/* Hero Section */}
                <div className="mb-12 text-center">
                    <p className="text-sm text-muted-foreground mb-4">
                        Última actualización: {new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">
                        Comunidad Informada, Comunidad Preparada.
                    </h2>
                    <p className="text-lg text-muted-foreground mt-4 max-w-2xl mx-auto">
                        SafeSpot es una plataforma de participación ciudadana que conecta vecinos para compartir información sobre seguridad.
                    </p>
                </div>

                <div className="space-y-12">

                    {/* 1. Quiénes Somos */}
                    <section className="bg-dark-card rounded-2xl p-8 border border-white/5 shadow-xl">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-2 bg-neon-green/10 rounded-lg">
                                <MapPin className="h-6 w-6 text-neon-green" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">1. Quiénes Somos</h2>
                        </div>
                        <div className="space-y-4 text-foreground/90 leading-relaxed">
                            <p>
                                SafeSpot es una <strong>plataforma comunitaria de participación ciudadana</strong> que conecta a vecinos y vecinas para compartir información sobre seguridad en sus barrios.
                            </p>
                            <p>
                                Somos una herramienta tecnológica creada para empoderar a la comunidad, facilitando la comunicación entre ciudadanos y ayudando a visualizar patrones de incidentes en tiempo real.
                            </p>
                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5">
                                <strong className="text-red-400 block mb-2 uppercase tracking-wider text-sm">Importante</strong>
                                <p className="text-white">
                                    SafeSpot <strong>NO ES UN SERVICIO DE EMERGENCIA</strong> ni reemplaza a las fuerzas de seguridad. Somos un canal de información comunitaria que complementa, pero nunca sustituye, los canales oficiales de denuncia y emergencia.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 2. Nuestra Misión */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Heart className="h-6 w-6 text-neon-green" />
                            2. Nuestra Misión
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            Creemos que una comunidad informada es una comunidad más preparada. Nuestra misión es facilitar la participación ciudadana responsable mediante una plataforma que permita:
                        </p>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-2 text-neon-green font-bold">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Compartir Información Relevante</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Sobre incidentes en tu zona de forma rápida y anónima
                                </p>
                            </div>
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-2 text-neon-green font-bold">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Visualizar Patrones</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Que ayuden a entender mejor tu entorno
                                </p>
                            </div>
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-2 text-neon-green font-bold">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Fortalecer Lazos Comunitarios</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    A través de la colaboración vecinal
                                </p>
                            </div>
                            <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-2 text-neon-green font-bold">
                                    <CheckCircle className="h-4 w-4" />
                                    <span>Promover Uso Responsable</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    De la información para tomar mejores decisiones
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 3. Qué Hacemos */}
                    <section className="bg-white/5 rounded-2xl p-8 border border-white/5">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Eye className="h-6 w-6 text-blue-400" />
                            3. Qué Hacemos
                        </h2>
                        <div className="space-y-6">
                            <div>
                                <h3 className="font-semibold text-white mb-2">Facilitamos Reportes Comunitarios</h3>
                                <p className="text-sm text-muted-foreground">
                                    Permitimos que cualquier persona pueda reportar incidentes observados en su barrio de forma rápida y anónima (si así lo prefiere).
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-2">Visualizamos Información en Tiempo Real</h3>
                                <p className="text-sm text-muted-foreground">
                                    Transformamos los reportes individuales en un mapa interactivo que permite ver incidentes, identificar patrones y acceder a estadísticas comunitarias.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white mb-2">Fomentamos la Participación Responsable</h3>
                                <p className="text-sm text-muted-foreground">
                                    Promovemos el uso consciente mediante moderación de contenido, verificación comunitaria y educación sobre uso responsable.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 4. Qué NO Hacemos */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <AlertTriangle className="h-6 w-6 text-red-400" />
                            4. Qué NO Hacemos
                        </h2>
                        <div className="space-y-4">
                            <div className="p-5 bg-red-500/5 rounded-xl border border-red-500/20">
                                <div className="flex items-center gap-2 mb-2 text-red-400 font-bold">
                                    <XCircle className="h-4 w-4" />
                                    <span>No Somos un Servicio de Emergencia</span>
                                </div>
                                <p className="text-sm text-muted-foreground mb-3">
                                    <strong className="text-white">En caso de emergencia, siempre contactá primero a los servicios oficiales:</strong>
                                </p>
                                <ul className="text-sm text-muted-foreground space-y-1 ml-6">
                                    <li>• <strong>Policía:</strong> 911</li>
                                    <li>• <strong>Bomberos:</strong> 100</li>
                                    <li>• <strong>Emergencias médicas:</strong> 107</li>
                                </ul>
                                <p className="text-sm text-muted-foreground mt-3">
                                    SafeSpot no monitorea reportes en tiempo real ni puede garantizar respuestas inmediatas.
                                </p>
                            </div>

                            <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-2 text-yellow-400 font-bold">
                                    <XCircle className="h-4 w-4" />
                                    <span>No Reemplazamos a las Fuerzas de Seguridad</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Los reportes en nuestra plataforma no constituyen denuncias formales ante autoridades ni inician investigaciones policiales. Para denuncias formales, dirigite a las comisarías o fiscalías correspondientes.
                                </p>
                            </div>

                            <div className="p-5 bg-white/5 rounded-xl border border-white/5">
                                <div className="flex items-center gap-2 mb-2 text-orange-400 font-bold">
                                    <XCircle className="h-4 w-4" />
                                    <span>No Garantizamos Seguridad Total</span>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    La información proviene de reportes ciudadanos que pueden contener errores o imprecisiones. <strong className="text-white">El uso de SafeSpot no elimina riesgos ni garantiza tu seguridad personal.</strong>
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 5. Compromiso con Privacidad */}
                    <section className="bg-dark-card rounded-2xl p-8 border border-white/5">
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Shield className="h-6 w-6 text-purple-400" />
                            5. Nuestro Compromiso con la Privacidad
                        </h2>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-semibold text-white mb-2 text-sm">Datos Mínimos</h3>
                                <p className="text-xs text-muted-foreground">
                                    Solo recopilamos la información estrictamente necesaria para que la plataforma funcione.
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-semibold text-white mb-2 text-sm">Anonimato Opcional</h3>
                                <p className="text-xs text-muted-foreground">
                                    Podés reportar incidentes de forma anónima si así lo preferís.
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-semibold text-white mb-2 text-sm">Transparencia</h3>
                                <p className="text-xs text-muted-foreground">
                                    Nuestras políticas están disponibles públicamente y explicadas en lenguaje claro.
                                </p>
                            </div>
                            <div className="p-4 bg-white/5 rounded-lg">
                                <h3 className="font-semibold text-white mb-2 text-sm">Control Total</h3>
                                <p className="text-xs text-muted-foreground">
                                    Tenés derecho a acceder, modificar o eliminar tus datos en cualquier momento.
                                </p>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-6">
                            Para más detalles, consultá nuestra <Link to="/privacidad" className="text-neon-green hover:underline">Política de Privacidad</Link>.
                        </p>
                    </section>

                    {/* 6. Uso Responsable */}
                    <section>
                        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                            <Users className="h-6 w-6 text-blue-400" />
                            6. Uso Responsable de la Plataforma
                        </h2>
                        <p className="text-muted-foreground mb-6">
                            SafeSpot es una herramienta poderosa cuando se usa de forma consciente y responsable.
                        </p>
                        <div className="grid md:grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-semibold text-neon-green mb-3">✅ Te Pedimos Que:</h3>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>• Reportes con precisión y objetividad</li>
                                    <li>• Respetes a otros usuarios</li>
                                    <li>• Protejas la privacidad ajena</li>
                                    <li>• Uses la plataforma para informar, no alarmar</li>
                                    <li>• Complementes con canales oficiales</li>
                                </ul>
                            </div>
                            <div>
                                <h3 className="font-semibold text-red-400 mb-3">❌ No Está Permitido:</h3>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>• Publicar información falsa o engañosa</li>
                                    <li>• Usar la plataforma para acosar o difamar</li>
                                    <li>• Compartir contenido ilegal o violento</li>
                                    <li>• Suplantar identidades o crear perfiles falsos</li>
                                    <li>• Usar SafeSpot con fines comerciales no autorizados</li>
                                </ul>
                            </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-6">
                            El incumplimiento de estas normas puede resultar en la suspensión de tu cuenta. Ver más en <Link to="/terminos" className="text-neon-green hover:underline">Términos y Condiciones</Link>.
                        </p>
                    </section>

                </div>

                {/* Footer Contact */}
                <div className="border-t border-white/10 pt-12 mt-12 text-center">
                    <h3 className="text-xl font-bold text-white mb-4">
                        Usá SafeSpot de Forma Consciente
                    </h3>
                    <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                        La seguridad comunitaria es una responsabilidad compartida. Cada reporte, cada interacción, cada decisión que tomás en la plataforma tiene un impacto en tu comunidad.
                    </p>
                    <p className="text-lg text-white font-medium">
                        Juntos, podemos construir comunidades más informadas, conectadas y preparadas.
                    </p>
                </div>

                {/* Legal Note */}
                <div className="mt-12 p-6 bg-white/5 rounded-xl border border-white/5">
                    <p className="text-xs text-muted-foreground text-center">
                        <strong>Nota Legal:</strong> SafeSpot es una plataforma de información comunitaria independiente. No estamos afiliados con ninguna entidad gubernamental, fuerza de seguridad o servicio de emergencia. El uso de esta plataforma es bajo tu propia responsabilidad y no constituye asesoramiento legal, policial o de seguridad profesional.
                    </p>
                </div>

            </main>
        </div>
    );
}
