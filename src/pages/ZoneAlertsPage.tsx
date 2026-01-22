import { useState, useEffect, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import { generateSEOTags } from '@/lib/seo'
import { seoApi } from '@/lib/api' // Removed reportsApi
import type { ZoneSEO } from '@/lib/api' // Removed Report type
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, TrendingUp, Shield, ArrowLeft } from 'lucide-react'
import { ReportCardSkeleton } from '@/components/ui/skeletons'
import { EmptyState } from '@/components/ui/empty-state'
import { useNavigate } from 'react-router-dom'
import { useReportsQuery } from '@/hooks/queries/useReportsQuery'
import { ReportCard } from '@/components/ReportCard'
import { useAuthGuard } from '@/hooks/useAuthGuard'

export function ZoneAlertsPage() {
    const navigate = useNavigate()
    const { checkAuth } = useAuthGuard()

    // 🛡️ PRE-AUTH GUARD: Check auth BEFORE navigating to form
    const handleCreateReport = () => {
        if (!checkAuth()) return;
        navigate('/crear-reporte');
    };

    const { zoneSlug } = useParams<{ zoneSlug: string }>()
    const [zones, setZones] = useState<ZoneSEO[]>([])
    const [loadingZones, setLoadingZones] = useState(true)
    const [zonesError, setZonesError] = useState<string | null>(null)

    // Find the current zone display name from slug
    const currentZone = useMemo(() => {
        return zones.find(z => z.slug === zoneSlug)
    }, [zones, zoneSlug])

    const zoneName = currentZone?.name || zoneSlug?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') || 'Zona Desconocida'

    // SSOT: Use React Query for reports
    const {
        data: reportIds = [],
        isLoading: loadingReports,
        isError: reportsError
    } = useReportsQuery({
        zone: zoneName,
        limit: 20
    })

    useEffect(() => {
        async function fetchZones() {
            setLoadingZones(true)
            try {
                const zoneData = await seoApi.getZones()
                setZones(zoneData)
            } catch (err) {
                console.error('Error fetching zone data:', err)
                setZonesError('No pudimos cargar la información de esta zona.')
            } finally {
                setLoadingZones(false)
            }
        }

        if (zoneSlug) {
            fetchZones()
        }
    }, [zoneSlug])

    const loading = loadingZones || loadingReports
    const error = zonesError || (reportsError ? 'Error al cargar los reportes' : null)

    // SEO
    const seo = generateSEOTags({
        title: `Alertas de Robos en ${zoneName} | SafeSpot`,
        description: `Consultá el mapa de alertas y últimos robos reportados en ${zoneName}. Información comunitaria en tiempo real para moverte más seguro por el barrio.`,
        canonical: `https://safespot.tuweb-ai.com/alertas/${zoneSlug}`,
        type: 'website'
    })

    // Dynamic Contextual Intro (Programmatic)
    const getContextualIntro = () => {
        if (reportIds.length === 0) return `Actualmente no hay reportes recientes en ${zoneName}. SafeSpot es una red ciudadana colaborativa: si sabés de algún incidente, tu reporte puede ayudar a otros vecinos.`
        return `Se han detectado ${reportIds.length} incidentes recientes en ${zoneName}. Esta información es generada de forma anónima y colaborativa por ciudadanos de la zona para fomentar la prevención comunitaria.`
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

    // Helper functions removed as they are handled by ReportCard now

    return (
        <div className="min-h-screen bg-dark-bg">
            <Helmet>
                <title>{seo.title}</title>
                <meta name="description" content={seo.description} />
                <link rel="canonical" href={seo.canonical} />

                {/* High-Authority Indexation (Editorial Content) */}
                <meta name="robots" content="index, follow" />

                {/* OG Tags */}
                <meta property="og:title" content={seo.ogTitle} />
                <meta property="og:description" content={seo.ogDescription} />
                <meta property="og:url" content={seo.ogUrl} />
                <meta property="og:type" content="website" />

                {/* Structured Data (BreadcrumbList & Place) */}
                <script type="application/ld+json">
                    {JSON.stringify({
                        "@context": "https://schema.org",
                        "@graph": [
                            {
                                "@type": "BreadcrumbList",
                                "itemListElement": [
                                    {
                                        "@type": "ListItem",
                                        "position": 1,
                                        "name": "Inicio",
                                        "item": "https://safespot.tuweb-ai.com"
                                    },
                                    {
                                        "@type": "ListItem",
                                        "position": 2,
                                        "name": "Alertas",
                                        "item": "https://safespot.tuweb-ai.com/reportes"
                                    },
                                    {
                                        "@type": "ListItem",
                                        "position": 3,
                                        "name": zoneName,
                                        "item": seo.canonical
                                    }
                                ]
                            },
                            {
                                "@type": "Place",
                                "name": zoneName,
                                "address": {
                                    "@type": "PostalAddress",
                                    "addressLocality": zoneName,
                                    "addressRegion": "Argentina"
                                }
                            }
                        ]
                    })}
                </script>
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
                                        {reportIds.length}
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
                    ) : reportIds.length === 0 ? (
                        <EmptyState
                            variant="default"
                            title="Sin incidentes recientes"
                            description="No se encontraron reportes recientes en esta zona específica. Si viste algo, podés ser el primero en reportarlo."
                            action={{
                                label: "Reportar un incidente",
                                onClick: handleCreateReport,
                                variant: "neon"
                            }}
                            className="bg-dark-card border border-dark-border rounded-xl py-12"
                        />
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {reportIds.map((report: any) => (
                                <div key={report.id} className="h-full">
                                    <ReportCard
                                        reportId={report.id}
                                        onToggleFavorite={() => { }}
                                        onFlag={() => { }}
                                        isFlagging={false}
                                    />
                                </div>
                            ))}
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
                        <Button onClick={handleCreateReport} variant="neon" className="w-full">Reportar ahora</Button>
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
