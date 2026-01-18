import { ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Activity, Server, Database, Globe } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { StatusIndicator } from '@/components/layout/StatusIndicator'

interface ServiceStatus {
    name: string;
    description: string;
    status: 'operational' | 'degraded' | 'outage';
    icon: any;
}

const services: ServiceStatus[] = [
    { name: 'Plataforma Web', description: 'Acceso y navegación general', status: 'operational', icon: Globe },
    { name: 'API Gateway', description: 'Procesamiento de reportes y datos', status: 'operational', icon: Server },
    { name: 'Base de Datos', description: 'Persistencia y seguridad de la información', status: 'operational', icon: Database },
    { name: 'Geolocalización', description: 'Mapas y resolución de ubicación', status: 'operational', icon: Activity },
    { name: 'Notificaciones', description: 'Sistema de alertas en tiempo real', status: 'operational', icon: ShieldCheck },
]

export function SystemStatus() {
    return (
        <div className="min-h-screen bg-dark-bg text-foreground pb-20">
            {/* Header Hero */}
            <div className="relative bg-dark-card border-b border-dark-border py-16">
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neon-green/30 to-transparent" />
                <div className="container mx-auto px-4 max-w-4xl text-center">
                    <div className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full bg-neon-green/10 border border-neon-green/20">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span className="text-sm font-medium text-neon-green">Todos los sistemas operativos</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
                        Estado del Sistema
                    </h1>
                    <p className="text-xl text-foreground/60 max-w-2xl mx-auto">
                        Monitoreo en tiempo real de la infraestructura de SafeSpot.
                        La transparencia y disponibilidad son nuestros pilares fundamentales.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 max-w-4xl -mt-8">
                {/* Global Status Card */}
                <Card className="bg-dark-card/50 backdrop-blur-xl border border-dark-border shadow-xl mb-12">
                    <CardContent className="p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div>
                                <h3 className="text-lg font-semibold text-white">Salud Operativa Global</h3>
                                <p className="text-foreground/60">Todos los servicios funcionan con normalidad.</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="text-xs font-mono text-foreground/40 uppercase tracking-widest block mb-1">Última actualización</span>
                            <span className="text-sm font-medium text-white">{new Date().toLocaleString()}</span>
                        </div>
                    </CardContent>
                </Card>

                {/* Detailed Services Grid */}
                <div className="space-y-8">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-foreground/80 pl-2 border-l-4 border-neon-green">
                        Estado de Servicios
                    </h2>

                    <div className="grid gap-4">
                        {services.map((service, idx) => (
                            <ServiceRow key={idx} service={service} />
                        ))}
                    </div>
                </div>

                {/* Incident History Placeholder */}
                <div className="mt-16 space-y-8">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-foreground/80 pl-2 border-l-4 border-dark-border">
                        Historial de Incidentes
                    </h2>

                    <div className="bg-dark-card border border-dark-border rounded-xl p-8 text-center text-foreground/50">
                        <CheckCircle2 className="w-12 h-12 mx-auto mb-4 text-emerald-500/50" />
                        <h3 className="text-lg font-medium text-white mb-2">Sin incidentes reportados</h3>
                        <p>No se han registrado interrupciones de servicio en los últimos 90 días.</p>
                    </div>
                </div>

                {/* Commitment Block */}
                <div className="mt-16 pt-8 border-t border-dark-border text-center">
                    <p className="text-sm text-foreground/40 leading-relaxed max-w-2xl mx-auto">
                        SafeSpot se compromete a comunicar cualquier degradación de servicio de manera inmediata.
                        Nuestros ingenieros monitorean la plataforma 24/7 para garantizar que siempre puedas contar con nosotros cuando más importa.
                    </p>
                </div>
            </div>
        </div>
    )
}

function ServiceRow({ service }: { service: ServiceStatus }) {
    const StatusIcon = service.status === 'operational' ? CheckCircle2 : service.status === 'degraded' ? AlertTriangle : XCircle
    const statusColor = service.status === 'operational' ? 'text-emerald-500' : service.status === 'degraded' ? 'text-yellow-500' : 'text-red-500'
    const statusBg = service.status === 'operational' ? 'bg-emerald-500/10 border-emerald-500/20' : service.status === 'degraded' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-red-500/10 border-red-500/20'
    const statusText = service.status === 'operational' ? 'Operativo' : service.status === 'degraded' ? 'Rendimiento Degradado' : 'Interrupción'

    return (
        <div className="group flex items-center justify-between p-5 rounded-xl bg-dark-card border border-dark-border hover:border-white/10 transition-all duration-300">
            <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg bg-dark-bg border border-dark-border group-hover:border-neon-green/30 transition-colors`}>
                    <service.icon className="w-5 h-5 text-foreground/70 group-hover:text-neon-green transition-colors" />
                </div>
                <div>
                    <h4 className="font-semibold text-white">{service.name}</h4>
                    <p className="text-sm text-foreground/50">{service.description}</p>
                </div>
            </div>

            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border ${statusBg}`}>
                <StatusIcon className={`w-4 h-4 ${statusColor}`} />
                <span className={`text-xs font-bold uppercase tracking-wider ${statusColor}`}>{statusText}</span>
            </div>
        </div>
    )
}
