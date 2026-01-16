/**
 * Política de Privacidad y Seguridad - SafeSpot
 * 
 * Documento vivo de privacidad.
 * Última actualización: {new Date().toLocaleDateString()}
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Database, Lock, Shield, Server, CheckCircle, FileKey, UserX } from 'lucide-react';

export default function PrivacidadPage() {
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
                    <h1 className="text-xl font-bold tracking-tight">Privacidad y Seguridad</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-16 max-w-4xl">

                {/* Hero Section */}
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-green/5 border border-neon-green/20 text-neon-green text-sm font-semibold mb-6">
                        <Shield className="h-4 w-4" />
                        <span>Arquitectura Zero-Trust</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                        Tu identidad es <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-emerald-600">intocable</span>.
                    </h2>
                    <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        SafeSpot no vende datos. SafeSpot protege ciudadanos. Hemos diseñado cada línea de código para garantizar tu anonimato criptográfico.
                    </p>
                </div>

                <div className="space-y-16">

                    {/* 1. Architecture */}
                    <section className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-neon-green/20 to-blue-500/20 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                        <div className="relative bg-zinc-900 border border-white/10 rounded-2xl p-8 md:p-10">
                            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <UserX className="h-7 w-7 text-neon-green" />
                                1. Anonimato por Diseño
                            </h3>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <p className="text-zinc-400 mb-4 leading-relaxed">
                                        No te pedimos registrarte para protegerte. Generamos una identificación criptográfica única en tu dispositivo:
                                    </p>
                                    <ul className="space-y-3">
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-5 w-5 text-neon-green shrink-0 mt-0.5" />
                                            <span className="text-zinc-300 text-sm"><strong>UUIDv4 Efímero:</strong> Un código aleatorio que no se vincula a tu persona física.</span>
                                        </li>
                                        <li className="flex items-start gap-3">
                                            <CheckCircle className="h-5 w-5 text-neon-green shrink-0 mt-0.5" />
                                            <span className="text-zinc-300 text-sm"><strong>Sin Rastreo Cruzado:</strong> No usamos cookies de terceros ni pixeles de seguimiento.</span>
                                        </li>
                                    </ul>
                                </div>
                                <div className="border-l border-white/10 pl-8 hidden md:block">
                                    <p className="text-sm font-mono text-zinc-500 mb-2">DB SECURITY POLICY</p>
                                    <p className="text-zinc-300 text-sm">
                                        Implementamos <strong>RLS (Row Level Security)</strong> en PostgreSQL. Esto asegura que, a nivel de base de datos, solo tu UUID puede editar o borrar tus propios reportes. Ni siquiera un error en la aplicación podría exponer tus acciones privadas.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. Data Minimization */}
                    <section>
                        <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                            <Database className="h-6 w-6 text-blue-400" />
                            2. Minimización de Datos
                        </h3>
                        <div className="grid md:grid-cols-3 gap-6">
                            <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                <h4 className="font-semibold text-white mb-2">Geolocalización</h4>
                                <p className="text-sm text-zinc-400">
                                    Solo guardamos coordenadas (lat/lng) al momento exacto de crear un reporte. No rastreamos tu ubicación en segundo plano.
                                </p>
                            </div>
                            <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                <h4 className="font-semibold text-white mb-2">Evidencia Visual</h4>
                                <p className="text-sm text-zinc-400">
                                    Al subir fotos, nuestro servidor elimina automáticamente los metadatos <strong>EXIF</strong> (Modelo de cámara, GPS, Fecha) antes de guardar el archivo.
                                </p>
                            </div>
                            <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                <h4 className="font-semibold text-white mb-2">Retención</h4>
                                <p className="text-sm text-zinc-400">
                                    Los reportes antiguos se archivan automáticamente para mantener el mapa relevante y proteger el histórico de los usuarios.
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* 3. Google Integration */}
                    <section>
                        <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                            <Eye className="h-6 w-6 text-indigo-400" />
                            3. Integración con Google (Opcional)
                        </h3>
                        <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-8">
                            <p className="text-zinc-200 mb-4 font-medium">
                                Si eliges conectar tu cuenta para guardar progreso (Badges/Reputación):
                            </p>
                            <ul className="space-y-4">
                                <li className="flex gap-4">
                                    <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-indigo-400">1</span>
                                    </div>
                                    <div>
                                        <strong className="block text-white text-sm">Acceso Limitado</strong>
                                        <span className="text-zinc-400 text-sm">Solo leemos tu email (identificación), nombre y foto (perfil público).</span>
                                    </div>
                                </li>
                                <li className="flex gap-4">
                                    <div className="h-6 w-6 rounded-full bg-indigo-500/20 flex items-center justify-center shrink-0">
                                        <span className="text-xs font-bold text-indigo-400">2</span>
                                    </div>
                                    <div>
                                        <strong className="block text-white text-sm">Política de No-Transferencia</strong>
                                        <span className="text-zinc-400 text-sm">Cumplimos estrictamente la <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline hover:text-indigo-200">Google API User Data Policy</a>. Jamás vendemos, transferimos ni usamos tus datos para publicidad.</span>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </section>

                    {/* 4. Infrastructure */}
                    <section>
                        <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                            <Server className="h-6 w-6 text-emerald-400" />
                            4. Infraestructura Blindada
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-white/5 rounded-xl">
                                <Lock className="h-8 w-8 text-emerald-500/50" />
                                <div>
                                    <strong className="block text-white">Encriptación en Tránsito</strong>
                                    <span className="text-xs text-zinc-500">TLS 1.2+ / SSL Grado Militar</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 p-4 bg-zinc-900 border border-white/5 rounded-xl">
                                <FileKey className="h-8 w-8 text-emerald-500/50" />
                                <div>
                                    <strong className="block text-white">Encriptación en Reposo</strong>
                                    <span className="text-xs text-zinc-500">AES-256 en Base de Datos</span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 5. Derechos ARCO */}
                    <section className="border-t border-white/10 pt-12">
                        <h3 className="text-xl font-bold mb-4 text-white">Tus Derechos (Habeas Data)</h3>
                        <p className="text-zinc-400 text-sm mb-4">
                            Como usuario tienes derecho total sobre tus datos (Acceso, Rectificación, Cancelación, Oposición). Puedes ejercer estos derechos contactando a nuestro equipo de soporte legal.
                        </p>
                    </section>

                </div>

                {/* Footer Navigation */}
                <div className="mt-20 pt-8 border-t border-white/5 flex justify-between items-center text-sm text-zinc-500">
                    <p>© 2024 SafeSpot App.</p>
                    <div className="flex gap-6">
                        <Link to="/terminos" className="hover:text-white transition-colors">Ver Términos y Condiciones</Link>
                    </div>
                </div>

            </main>
        </div>
    );
}
