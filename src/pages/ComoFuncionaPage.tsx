import { Link } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Share2, Zap, Shield, Search, Users, Smartphone, MapPin, Bike, Smartphone as PhoneIcon, PenTool, Car, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ComoFuncionaPage() {
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
                    <h1 className="text-xl font-bold tracking-tight">Cómo funciona SafeSpot</h1>
                </div>
            </header>

            <main className="container mx-auto px-4 py-16 max-w-4xl">

                {/* Hero Section */}
                <div className="text-center mb-20">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-neon-green/5 border border-neon-green/20 text-neon-green text-sm font-semibold mb-6">
                        <Share2 className="h-4 w-4" />
                        <span>Colaboración Ciudadana</span>
                    </div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tighter text-white mb-6">
                        Recuperamos lo tuyo <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-green to-emerald-600">juntos</span>.
                    </h2>
                    <p className="text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                        Un sistema colaborativo para reportar robos, alertar a la comunidad y aumentar drásticamente las probabilidades de recuperación.
                    </p>
                </div>

                <div className="space-y-16">

                    {/* 1. El Problema */}
                    <section>
                        <div className="bg-zinc-900/50 border border-white/10 rounded-2xl p-8 md:p-10">
                            <h3 className="text-2xl font-bold mb-6 flex items-center gap-3">
                                <AlertTriangle className="h-7 w-7 text-red-500" />
                                El Problema
                            </h3>
                            <div className="grid md:grid-cols-2 gap-8">
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-2">Por qué es difícil hoy</h4>
                                    <p className="text-zinc-400 leading-relaxed mb-4">
                                        Cuando sufres un robo, los primeros minutos son críticos. Sin embargo, la burocracia, la falta de información centralizada y el aislamiento hacen que la mayoría de los objetos nunca se recuperen.
                                    </p>
                                </div>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 bg-red-500/10 p-1 rounded-md">
                                            <Search className="h-4 w-4 text-red-500" />
                                        </div>
                                        <div>
                                            <strong className="block text-zinc-200 text-sm">Información dispersa</strong>
                                            <span className="text-zinc-500 text-xs text-balance">Los reportes en redes sociales se pierden en el ruido.</span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="mt-1 bg-red-500/10 p-1 rounded-md">
                                            <Zap className="h-4 w-4 text-red-500" />
                                        </div>
                                        <div>
                                            <strong className="block text-zinc-200 text-sm">Tiempo perdido</strong>
                                            <span className="text-zinc-500 text-xs text-balance">Cada hora que pasa reduce exponencialmente la chance de recuperación.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* 2. El Flujo SafeSpot */}
                    <section>
                        <h3 className="text-2xl font-bold mb-10 flex items-center gap-3 justify-center">
                            <Share2 className="h-7 w-7 text-neon-green" />
                            El Flujo SafeSpot
                        </h3>

                        <div className="space-y-12 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-white/10 before:to-transparent">

                            {/* Step 1 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-zinc-900 group-hover:bg-neon-green/10 group-hover:border-neon-green/50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                                    <Smartphone className="w-5 h-5 text-zinc-400 group-hover:text-neon-green" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-zinc-900 border border-white/5 rounded-xl transition-all hover:border-white/10">
                                    <h4 className="text-lg font-bold text-white mb-2">1. Reportas el objeto</h4>
                                    <p className="text-zinc-400 text-sm">Creas un reporte en segundos con fotos, ubicación y descripción. El sistema genera un ID único y protegido.</p>
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-zinc-900 group-hover:bg-neon-green/10 group-hover:border-neon-green/50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                                    <Users className="w-5 h-5 text-zinc-400 group-hover:text-neon-green" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-zinc-900 border border-white/5 rounded-xl transition-all hover:border-white/10">
                                    <h4 className="text-lg font-bold text-white mb-2">2. Validación Comunitaria</h4>
                                    <p className="text-zinc-400 text-sm">La comunidad cercana recibe una alerta silenciosa. Validamos que el reporte sea legítimo para evitar spam.</p>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-zinc-900 group-hover:bg-neon-green/10 group-hover:border-neon-green/50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                                    <MapPin className="w-5 h-5 text-zinc-400 group-hover:text-neon-green" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-zinc-900 border border-white/5 rounded-xl transition-all hover:border-white/10">
                                    <h4 className="text-lg font-bold text-white mb-2">3. Avistamientos</h4>
                                    <p className="text-zinc-400 text-sm">Si alguien ve tu objeto, puede marcar un "avistamiento" anónimo en el mapa, sin confrontación ni riesgo.</p>
                                </div>
                            </div>

                            {/* Step 4 */}
                            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                                <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white/10 bg-zinc-900 group-hover:bg-neon-green/10 group-hover:border-neon-green/50 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 transition-colors">
                                    <CheckCircle className="w-5 h-5 text-zinc-400 group-hover:text-neon-green" />
                                </div>
                                <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-6 bg-zinc-900 border border-white/5 rounded-xl transition-all hover:border-white/10">
                                    <h4 className="text-lg font-bold text-white mb-2">4. Recuperación</h4>
                                    <p className="text-zinc-400 text-sm">Con la información de los puntos de avistamiento, aumentas la probabilidad de recuperar tu bien con ayuda de autoridades.</p>
                                </div>
                            </div>

                        </div>
                    </section>

                    {/* 3. Qué hace SafeSpot diferente */}
                    <section>
                        <h3 className="text-2xl font-bold mb-8 flex items-center gap-3">
                            <Shield className="h-6 w-6 text-blue-400" />
                            ¿Por qué SafeSpot?
                        </h3>
                        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                <Users className="h-8 w-8 text-blue-400 mb-4" />
                                <h4 className="font-semibold text-white mb-2">Red de Sensores</h4>
                                <p className="text-sm text-zinc-400">Cada usuario es un sensor pasivo que protege a los demás.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                <Shield className="h-8 w-8 text-emerald-400 mb-4" />
                                <h4 className="font-semibold text-white mb-2">Privacidad</h4>
                                <p className="text-sm text-zinc-400">Tu identidad nunca se expone públicamente en los reportes.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                <Zap className="h-8 w-8 text-yellow-400 mb-4" />
                                <h4 className="font-semibold text-white mb-2">Tiempo Real</h4>
                                <p className="text-sm text-zinc-400">Alertas instantáneas a usuarios relevantes en la zona.</p>
                            </div>
                            <div className="bg-zinc-900/50 p-6 rounded-xl border border-white/5">
                                <Smartphone className="h-8 w-8 text-purple-400 mb-4" />
                                <h4 className="font-semibold text-white mb-2">Data-Driven</h4>
                                <p className="text-sm text-zinc-400">Mapas de calor para prevenir futuros incidentes.</p>
                            </div>
                        </div>
                    </section>

                    {/* 4. Casos de Uso */}
                    <section>
                        <h3 className="text-2xl font-bold mb-8 text-white">Lo que protegemos</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="p-4 bg-zinc-900 border border-white/5 rounded-xl flex flex-col items-center text-center hover:bg-zinc-800/50 transition-colors">
                                <Bike className="h-8 w-8 text-zinc-400 mb-3" />
                                <span className="text-sm font-medium text-zinc-200">Bicicletas</span>
                            </div>
                            <div className="p-4 bg-zinc-900 border border-white/5 rounded-xl flex flex-col items-center text-center hover:bg-zinc-800/50 transition-colors">
                                <PhoneIcon className="h-8 w-8 text-zinc-400 mb-3" />
                                <span className="text-sm font-medium text-zinc-200">Celulares</span>
                            </div>
                            <div className="p-4 bg-zinc-900 border border-white/5 rounded-xl flex flex-col items-center text-center hover:bg-zinc-800/50 transition-colors">
                                <PenTool className="h-8 w-8 text-zinc-400 mb-3" />
                                <span className="text-sm font-medium text-zinc-200">Herramientas</span>
                            </div>
                            <div className="p-4 bg-zinc-900 border border-white/5 rounded-xl flex flex-col items-center text-center hover:bg-zinc-800/50 transition-colors">
                                <Car className="h-8 w-8 text-zinc-400 mb-3" />
                                <span className="text-sm font-medium text-zinc-200">Vehículos</span>
                            </div>
                        </div>
                    </section>

                    {/* Cierre */}
                    <section className="border-t border-white/10 pt-16 pb-8 text-center">
                        <h3 className="text-3xl font-black text-white mb-6">Únete a la resistencia pasiva.</h3>
                        <p className="text-zinc-400 max-w-xl mx-auto mb-8">
                            Cada usuario nuevo hace que la red sea exponencialmente más segura. No necesitas ser un héroe, solo estar presente.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-4 justify-center">
                            <Link to="/crear-reporte">
                                <Button className="w-full sm:w-auto bg-neon-green text-black hover:bg-neon-green/90 font-bold px-8 py-6 rounded-full text-lg shadow-lg shadow-neon-green/20">
                                    Crear un Reporte
                                </Button>
                            </Link>
                            <Link to="/register">
                                <Button variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 px-8 py-6 rounded-full text-lg">
                                    Unirse a la Comunidad
                                </Button>
                            </Link>
                        </div>
                    </section>

                </div>

            </main>
        </div>
    );
}
