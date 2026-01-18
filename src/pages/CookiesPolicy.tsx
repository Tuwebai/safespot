import { Cookie, Shield, Eye, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

export function CookiesPolicy() {
    return (
        <div className="min-h-screen bg-dark-bg text-foreground pb-20">
            {/* Header */}
            <div className="relative bg-dark-card border-b border-dark-border py-16">
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-neon-green/20 to-emerald-500/20 border border-neon-green/30 mb-8 shadow-lg shadow-neon-green/10">
                        <Cookie className="w-8 h-8 text-neon-green" />
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">
                        Política de Cookies
                    </h1>
                    <p className="text-xl text-foreground/60 max-w-2xl mx-auto leading-relaxed">
                        Creemos en la transparencia total. Aquí te explicamos qué son, por qué las usamos y cómo respetamos tu privacidad.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 max-w-3xl mt-12 space-y-12">

                {/* Introduction */}
                <section className="prose prose-invert max-w-none">
                    <p className="text-lg leading-relaxed text-foreground/80">
                        En **SafeSpot**, utilizamos cookies (pequeños archivos de texto que se guardan en tu dispositivo) con un único propósito:
                        **hacer que la plataforma funcione de manera segura y eficiente para vos**.
                    </p>
                    <p className="text-lg leading-relaxed text-foreground/80">
                        No vendemos tu información ni utilizamos rastreadores invasivos. Nuestra prioridad es tu seguridad y la de tu comunidad.
                    </p>
                </section>

                {/* Cookie Types Grid */}
                <div className="grid gap-6">
                    <CookieCard
                        icon={Shield}
                        title="Esenciales y de Seguridad"
                        description="Son vitales. Nos permiten saber quién sos cuando iniciás sesión, proteger tu cuenta contra accesos no autorizados y asegurar que tus reportes lleguen a destino."
                        status="Necesarias"
                    />
                    <CookieCard
                        icon={Settings}
                        title="Preferencias y Funcionalidad"
                        description="Recuerdan tus ajustes, como el tema oscuro/claro o tu ubicación predeterminada en el mapa, para que no tengas que configurarlos cada vez que entrás."
                        status="Funcionales"
                    />
                    <CookieCard
                        icon={Eye}
                        title="Rendimiento y Métricas"
                        description="Usamos métricas anónimas para entender qué partes de la app se usan más y detectar errores. Estos datos nunca están vinculados a tu identidad personal."
                        status="Analíticas y Anónimas"
                    />
                </div>

                {/* User Control Section */}
                <section className="bg-dark-card border border-dark-border rounded-2xl p-8 mt-12">
                    <h2 className="text-2xl font-bold mb-4 text-white">Vos tenés el control</h2>
                    <p className="text-foreground/70 mb-6 leading-relaxed">
                        Aunque las cookies son necesarias para muchas funciones de SafeSpot, vos siempre tenés la última palabra.
                        Podés gestionar, bloquear o eliminar las cookies directamente desde la configuración de tu navegador.
                    </p>

                    <div className="flex flex-wrap gap-4 text-sm text-neon-green font-medium">
                        <span>Chrome: Configuración &gt; Privacidad</span>
                        <span className="text-foreground/20">|</span>
                        <span>Safari: Preferencias &gt; Privacidad</span>
                        <span className="text-foreground/20">|</span>
                        <span>Firefox: Opciones &gt; Privacidad</span>
                    </div>

                    <p className="text-sm text-foreground/40 mt-6 pt-6 border-t border-white/5">
                        Importante: Si desactivás las cookies esenciales, es posible que no puedas iniciar sesión o enviar reportes correctamente.
                    </p>
                </section>

                {/* Final Commitment */}
                <div className="text-center pt-8">
                    <p className="text-foreground/40 text-sm">
                        Última actualización: Enero 2024 &middot; SafeSpot Platform.
                    </p>
                </div>

            </div>
        </div>
    )
}

function CookieCard({ icon: Icon, title, description, status }: { icon: any, title: string, description: string, status: string }) {
    return (
        <Card className="bg-dark-card/50 border border-dark-border hover:border-neon-green/30 transition-all duration-300">
            <CardContent className="p-6 flex gap-6">
                <div className="shrink-0 w-12 h-12 rounded-xl bg-dark-bg border border-dark-border flex items-center justify-center">
                    <Icon className="w-6 h-6 text-foreground/70" />
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <h3 className="font-bold text-lg text-white">{title}</h3>
                        <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-foreground/60">{status}</span>
                    </div>
                    <p className="text-foreground/60 leading-relaxed text-sm">
                        {description}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
