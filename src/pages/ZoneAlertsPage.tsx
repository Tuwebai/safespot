import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { generateSEOTags } from '@/lib/seo'
import { seoApi, reportsApi } from '@/lib/api'
import type { Report, ZoneSEO } from '@/lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, TrendingUp, Shield, ArrowLeft } from 'lucide-react'
import { ReportCardSkeleton } from '@/components/ui/skeletons'
import { SmartLink } from '@/components/SmartLink'
import { OptimizedImage } from '@/components/OptimizedImage'

export function ZoneAlertsPage() {
    const { zoneSlug } = useParams<{ zoneSlug: string }>()
    const [zones, setZones] = useState<ZoneSEO[]>([])
    const [reports, setReports] = useState<Report[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Find the current zone display name from slug
    const currentZone = useMemo(() => {
        return zones.find(z => z.slug === zoneSlug)
    }, [zones, zoneSlug])

    const zoneName = currentZone?.name || zoneSlug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Zona Desconocida'

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            try {
                // 1. Fetch all zones to find the display name (cached in real use, but here simple)
                const zoneData = await seoApi.getZones()
                setZones(zoneData)

                // 2. Fetch reports for this specific zone
                // We use the real name found or fallback to slug transformation
                const zoneToSearch = zoneData.find(z => z.slug === zoneSlug)?.name || zoneName
                const reportsData = await reportsApi.getAll({ zone: zoneToSearch, limit: 20 })
                setReports(reportsData)
            } catch (err) {
                console.error('Error fetching zone data:', err)
                setError('No pudimos cargar la información de esta zona.')
            } finally {
                setLoading(false)
            }
        }

        if (zoneSlug) {
            fetchData()
        }
    }, [zoneSlug, zoneName])

    // SEO
    const seo = generateSEOTags({
        title: `Alertas de Robos en ${zoneName} | SafeSpot`,
        description: `Consultá el mapa de alertas y últimos robos reportados en ${zoneName}. Información comunitaria en tiempo real para moverte más seguro por el barrio.`,
        canonical: `https://safespot.tuweb-ai.com/alertas/${zoneSlug}`,
        type: 'website'
    })

    // Dynamic Contextual Intro (Programmatic)
    const getContextualIntro = () => {
        if (reports.length === 0) return `Actualmente no hay reportes recientes en ${zoneName}. SafeSpot es una red ciudadana colaborativa: si sabés de algún incidente, tu reporte puede ayudar a otros vecinos.`
        return `Se han detectado ${reports.length} incidentes recientes en ${zoneName}. Esta información es generada de forma anónima y colaborativa por ciudadanos de la zona para fomentar la prevención comunitaria.`
    }

    // Senior SEO Content Generator (300-500 words)
    const renderSEOContent = () => {
        return (
            <div className="prose prose-invert max-w-none mt-12 pt-12 border-t border-dark-border">
                <h2 className="text-3xl font-bold mb-6 text-foreground">Estado actual de la seguridad en {zoneName}</h2>
                <div className="space-y-4 text-foreground/70 leading-relaxed text-lg">
                    <p>
                        La seguridad en <strong>{zoneName}</strong> es una preocupación constante para quienes transitan y viven en el barrio. En SafeSpot, entendemos que la prevención comienza con la información compartida. Al monitorear en tiempo real las alertas de robos e incidentes en esta zona, nuestra comunidad logra identificar patrones que muchas veces pasan desapercibidos en los mapas tradicionales de criminalidad.
                    </p>
                    <p>
                        Nuestra plataforma se nutre exclusivamente de <strong>reportes de ciudadanos reales</strong>. Esto significa que cada alerta que ves en esta página de {zoneName} es un testimonio directo de un vecino que busca proteger a los demás. Ya sea un robo de bicicleta, un incidente en la vía pública o el hallazgo de objetos perdidos, la transparencia comunitaria es nuestra mayor herramienta contra la inseguridad local.
                    </p>

                    <h3 className="text-2xl font-bold mt-8 mb-4 text-foreground">¿Por qué es importante reportar en SafeSpot?</h3>
                    <p>
                        Muchas veces, los incidentes menores en barrios como {zoneName} no llegan a las noticias locales o no son denunciados formalmente debido a la complejidad de los procesos burocráticos. Sin embargo, para un vecino que camina por las mismas calles todos los días, saber que hubo un aumento de arrebatos en una esquina específica puede ser la diferencia entre evitar un mal momento o no.
                    </p>
                    <p>
                        Al usar SafeSpot en <strong>{zoneName}</strong>, estás contribuyendo a una construcción colectiva de seguridad. No solo se trata de alertar sobre el pasado, sino de prevenir incidentes futuros. Cuando reportás de manera anónima, ayudás a:
                    </p>
                    <ul className="list-disc pl-6 space-y-2 mt-4">
                        <li>Alertar a otros vecinos en tiempo real mediante notificaciones directas.</li>
                        <li>Identificar zonas "calientes" en {zoneName} que requieren mayor precaución o presencia.</li>
                        <li>Fomentar una cultura de colaboración ciudadana sin depender exclusivamente de intermediarios.</li>
                        <li>Facilitar la recuperación de objetos robados o perdidos mediante la red de avistamientos.</li>
                    </ul>

                    <h3 className="text-2xl font-bold mt-8 mb-4 text-foreground">Cómo colaborar con tus vecinos de {zoneName}</h3>
                    <p>
                        Si vivís o trabajás en {zoneName}, te invitamos a ser un miembro activo de esta red ciudadana. No necesitás crear una cuenta con tus datos personales; nuestro sistema está diseñado para ser <strong>100% anónimo</strong>, garantizando tu total privacidad y fomentando la honestidad en los reportes.
                    </p>
                    <p>
                        Podes usar el mapa interactivo para visualizar lo que está sucediendo cerca de tu ubicación actual, compartir fotos detalladas del incidente si es seguro hacerlo, y comentar en los reportes de otros vecinos para aportar información valiosa. Juntos, estamos transformando el miedo en información procesable y la información en un barrio más seguro para todos en {zoneName}.
                    </p>
                    <p className="mt-6 italic">
                        Recordá que SafeSpot es una herramienta complementaria. Siempre que sea posible, recomendamos realizar la denuncia oficial ante las autoridades pertinentes para que el incidente quede registrado en las estadísticas públicas de {zoneName}.
                    </p>
                </div>
            </div>
        )
    }

    if (loading) {
        return (
            <div className="container mx-auto max-w-7xl px-4 py-12">
                <div className="animate-pulse space-y-8">
                    <div className="h-12 w-2/3 bg-dark-card rounded" />
                    <div className="h-24 w-full bg-dark-card rounded" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => <ReportCardSkeleton key={i} />)}
                    </div>
                </div>
            </div>
        )
    }

    const getStatusColor = (status: Report['status']) => {
        switch (status) {
            case 'pendiente': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
            case 'en_proceso': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
            case 'resuelto': return 'bg-green-500/20 text-green-400 border-green-500/30'
            case 'cerrado': return 'bg-red-500/20 text-red-400 border-red-500/30'
            default: return ''
        }
    }

    return (
        <div className="min-h-screen bg-dark-bg">
            <Helmet>
                <title>{seo.title}</title>
                <meta name="description" content={seo.description} />
                <link rel="canonical" href={seo.canonical} />
                {/* OG Tags */}
                <meta property="og:title" content={seo.ogTitle} />
                <meta property="og:description" content={seo.ogDescription} />
                <meta property="og:url" content={seo.ogUrl} />
                <meta property="og:type" content="website" />
            </Helmet>

            <div className="container mx-auto max-w-7xl px-4 py-8">
                {/* Navigation */}
                <Link to="/reportes" className="inline-flex items-center text-neon-green hover:underline mb-8">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Volver a todos los reportes
                </Link>

                {/* Hero / Header */}
                <div className="mb-12">
                    <Badge variant="outline" className="mb-4 border-neon-green/30 text-neon-green bg-neon-green/5">
                        Información Comunitaria
                    </Badge>
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 text-foreground">
                        Alertas de robos e incidentes en <span className="gradient-text">{zoneName}</span>
                    </h1>
                    <Card className="bg-dark-card border-neon-green/10 card-glow">
                        <CardContent className="p-6">
                            <div className="flex flex-col md:flex-row gap-8 items-start">
                                <div className="flex-1">
                                    <p className="text-lg text-foreground/80 leading-relaxed mb-4">
                                        {getContextualIntro()}
                                    </p>
                                    <div className="flex flex-wrap gap-4">
                                        <div className="flex items-center text-sm text-foreground/60">
                                            <Shield className="h-4 w-4 mr-2 text-neon-green" />
                                            Reportes Anónimos
                                        </div>
                                        <div className="flex items-center text-sm text-foreground/60">
                                            <TrendingUp className="h-4 w-4 mr-2 text-neon-green" />
                                            Actualización Automática
                                        </div>
                                    </div>
                                </div>
                                <div className="bg-neon-green/5 rounded-lg p-6 border border-neon-green/10 min-w-[200px]">
                                    <div className="text-4xl font-bold text-foreground mb-1">
                                        {reports.length}
                                    </div>
                                    <div className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
                                        Alertas Activas
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Reports List */}
                <div className="mb-12">
                    <div className="flex items-center justify-between mb-8">
                        <h2 className="text-2xl font-bold text-foreground flex items-center">
                            <MapPin className="h-6 w-6 mr-2 text-neon-green" />
                            Incidentes Recientes en la Zona
                        </h2>
                        <Link to="/explorar">
                            <Button variant="outline" size="sm" className="border-neon-green/30 hover:bg-neon-green/10">
                                Ver en el mapa
                            </Button>
                        </Link>
                    </div>

                    {error ? (
                        <Card className="bg-dark-card border-red-500/20 py-12 text-center">
                            <p className="text-foreground/70">{error}</p>
                        </Card>
                    ) : reports.length === 0 ? (
                        <Card className="bg-dark-card border-dark-border py-12 text-center">
                            <CardContent>
                                <p className="text-foreground/70 mb-6 font-medium">No se encontraron reportes recientes en esta zona específica.</p>
                                <Link to="/crear-reporte">
                                    <Button variant="neon">Reportar un incidente</Button>
                                </Link>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {reports.map((report) => {
                                const imageUrls = Array.isArray(report.image_urls) ? report.image_urls : []
                                return (
                                    <SmartLink
                                        key={report.id}
                                        to={`/reporte/${report.id}`}
                                        className="block h-full group"
                                    >
                                        <Card className="bg-dark-card border-dark-border card-glow h-full overflow-hidden hover:border-neon-green/50 transition-all duration-300 flex flex-col">
                                            {imageUrls.length > 0 && (
                                                <div className="relative aspect-video overflow-hidden">
                                                    <OptimizedImage
                                                        src={imageUrls[0]}
                                                        alt={report.title}
                                                        className="group-hover:scale-105 transition-transform duration-500"
                                                    />
                                                </div>
                                            )}
                                            <CardContent className="p-6 flex-1 flex flex-col">
                                                <div className="flex items-start justify-between mb-3">
                                                    <Badge className={getStatusColor(report.status)}>
                                                        {report.status.replace('_', ' ')}
                                                    </Badge>
                                                    <span className="text-xs text-muted-foreground">
                                                        {new Date(report.created_at).toLocaleDateString('es-AR')}
                                                    </span>
                                                </div>
                                                <h3 className="text-xl font-bold text-foreground mb-3 line-clamp-2">
                                                    {report.title}
                                                </h3>
                                                <p className="text-foreground/70 text-sm mb-6 line-clamp-3">
                                                    {report.description}
                                                </p>
                                                <div className="mt-auto flex items-center text-sm font-medium text-neon-green group-hover:translate-x-1 transition-transform">
                                                    Ver reporte completo →
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </SmartLink>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Senior SEO Content Section */}
                {renderSEOContent()}

                {/* Local Footer / CTA */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-12 border-t border-dark-border mt-12">
                    <div className="space-y-4">
                        <h4 className="font-bold text-lg">¿Viste algo en {zoneName}?</h4>
                        <p className="text-sm text-foreground/60 leading-relaxed">
                            Tu colaboración es fundamental. Si presenciaste un robo o encontraste algo sospechoso, repórtalo anónimamente.
                        </p>
                        <Link to="/crear-reporte" className="block">
                            <Button variant="neon" className="w-full">Reportar ahora</Button>
                        </Link>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-bold text-lg">Seguridad en {zoneName}</h4>
                        <p className="text-sm text-foreground/60 leading-relaxed">
                            SafeSpot analiza patrones de inseguridad para alertar a los vecinos y fomentar barrios más protegidos.
                        </p>
                    </div>
                    <div className="space-y-4">
                        <h4 className="font-bold text-lg">Otras zonas cercanas</h4>
                        <div className="flex flex-wrap gap-2">
                            {zones.filter(z => z.slug !== zoneSlug).slice(0, 5).map(z => (
                                <Link key={z.slug} to={`/alertas/${z.slug}`}>
                                    <Badge variant="secondary" className="bg-dark-border/50 hover:bg-neon-green/20 cursor-pointer">
                                        {z.name}
                                    </Badge>
                                </Link>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
