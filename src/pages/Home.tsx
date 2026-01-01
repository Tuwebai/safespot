import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MapPin, Shield, Users, Eye, TrendingUp, CheckCircle, Clock } from 'lucide-react'
import type { CategoryStats } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { useGlobalStatsQuery, useCategoryStatsQuery } from '@/hooks/queries'
import { Helmet } from 'react-helmet-async'
import { generateSEOTags } from '@/lib/seo'

// ============================================
// MEMOIZED SUB-COMPONENTS
// ============================================

const HeroSection = memo(() => (
  <section className="relative bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg py-24">
    <div
      className="absolute inset-0 opacity-20"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2300ff88' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    />
    <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="text-center animate-fade-in">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
          Tu zona segura,{' '}
          <span className="gradient-text">siempre</span>
        </h1>
        <p className="text-xl text-foreground/70 max-w-3xl mx-auto mb-8">
          SafeSpot es la plataforma colaborativa que te ayuda a reportar robos y recuperar objetos robados junto con tu comunidad.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/crear-reporte">
            <Button
              variant="neon"
              className="onboarding-create-report px-8 py-6 text-lg h-auto neon-glow"
            >
              <MapPin className="mr-2 h-5 w-5" />
              Crear Reporte
            </Button>
          </Link>
          <Link to="/explorar">
            <Button
              variant="outline"
              className="onboarding-map px-8 py-6 text-lg h-auto border-neon-green text-neon-green hover:bg-neon-green/10"
            >
              <Eye className="mr-2 h-5 w-5" />
              Ver Mapa
            </Button>
          </Link>
        </div>

        <div className="mt-8 animate-fade-in delay-300">
          <Link
            to="/perfil"
            className="text-sm font-medium text-foreground/50 hover:text-neon-green flex items-center justify-center gap-2 transition-colors group"
          >
            <TrendingUp className="w-4 h-4 group-hover:scale-110 transition-transform" />
            Ver mi progreso y logros
          </Link>
        </div>
      </div>
    </div>
  </section>
))

const FeatureCard = memo(({ title, description, icon: Icon }: { title: string, description: string, icon: any }) => (
  <Card className="bg-dark-card border-dark-border card-glow hover:border-neon-green/50 transition-colors">
    <CardContent className="p-6">
      <div className="w-16 h-16 rounded-full bg-neon-green/10 flex items-center justify-center mx-auto mb-4">
        <Icon className="h-8 w-8 text-neon-green" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-3 text-center">{title}</h3>
      <p className="text-sm text-foreground/70 leading-relaxed text-center">{description}</p>
    </CardContent>
  </Card>
))

const FeaturesSection = memo(() => {
  const features = [
    {
      title: 'Mapa Interactivo',
      description: 'Visualiza reportes de robos en tiempo real en un mapa interactivo con clustering inteligente.',
      icon: MapPin,
    },
    {
      title: 'Reportes Seguros',
      description: 'Reporta robos de forma anónima y segura con validación de contenido automática.',
      icon: Shield,
    },
    {
      title: 'Comunidad Activa',
      description: 'Conecta con otros ciudadanos para ayudar a recuperar objetos robados.',
      icon: Users,
    },
    {
      title: 'Seguimiento en Tiempo Real',
      description: 'Recibe notificaciones cuando haya actualizaciones en tus reportes.',
      icon: Eye,
    },
  ]

  return (
    <section className="bg-dark-bg py-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
            ¿Por qué elegir SafeSpot?
          </h2>
          <p className="text-xl text-foreground/70 max-w-2xl mx-auto">
            Nuestra plataforma está diseñada para hacer que reportar robos sea fácil, seguro y efectivo.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
})

const StatCard = memo(({ label, value, icon: Icon, color, loading }: { label: string, value: string, icon: any, color: string, loading: boolean }) => (
  <Card className="bg-dark-card border-dark-border card-glow">
    <CardContent className="p-6 text-center">
      <Icon className={`w-8 h-8 ${color} mx-auto mb-3`} />
      <div className="text-3xl font-bold text-foreground mb-2">
        {loading ? <Skeleton height={36} width={60} /> : value}
      </div>
      <div className="text-sm text-foreground/70">{label}</div>
    </CardContent>
  </Card>
))

const CategoryCard = memo(({ name, color, count }: { name: string, color: string, count: string }) => (
  <Card className="bg-dark-card border-dark-border card-glow hover:border-neon-green/50 transition-colors cursor-pointer">
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-4 h-4 rounded-full ${color}`}></div>
          <div className="text-base font-medium text-foreground">{name}</div>
        </div>
        <div className="text-2xl font-bold text-neon-green">{count}</div>
      </div>
    </CardContent>
  </Card>
))

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export function Home() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useGlobalStatsQuery()
  const { data: categoryStats, isLoading: categoryLoading, isError: categoryError } = useCategoryStatsQuery()

  const loading = statsLoading || categoryLoading
  const error = statsError || categoryError

  const statsDisplay = [
    {
      label: 'Reportes Totales',
      value: error ? '0' : (stats?.total_reports?.toString() || '0'),
      icon: TrendingUp,
      color: 'text-neon-green'
    },
    {
      label: 'Recuperados',
      value: error ? '0' : (stats?.resolved_reports?.toString() || '0'),
      icon: CheckCircle,
      color: 'text-green-400'
    },
    {
      label: 'Usuarios Totales',
      value: error ? '0' : (stats?.total_users?.toString() || '0'),
      icon: Users,
      color: 'text-blue-400'
    },
    {
      label: 'Usuarios Este Mes',
      value: error ? '0' : (stats?.active_users_month?.toString() || '0'),
      icon: Clock,
      color: 'text-yellow-400'
    },
  ]

  const categories = [
    { name: 'Celulares', color: 'bg-blue-500' },
    { name: 'Bicicletas', color: 'bg-green-500' },
    { name: 'Motos', color: 'bg-yellow-400' },
    { name: 'Autos', color: 'bg-red-500' },
    { name: 'Laptops', color: 'bg-purple-500' },
    { name: 'Carteras', color: 'bg-pink-500' },
  ]

  const seo = generateSEOTags({
    title: 'SafeSpot – Reportes Ciudadanos en Tiempo Real',
    description: 'Reporta y visualiza incidentes de seguridad en tu zona. Mapa colaborativo de la comunidad para moverte más seguro por la ciudad.',
    canonical: 'https://safespot.netlify.app/',
    type: 'website'
  })

  return (
    <div className="min-h-screen bg-dark-bg">
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.description} />
        <link rel="canonical" href={seo.canonical} />
        {/* ... Rest of SEO Meta Tags ... */}
        <meta property="og:type" content={seo.ogType} />
        <meta property="og:url" content={seo.ogUrl} />
        <meta property="og:title" content={seo.ogTitle} />
        <meta property="og:description" content={seo.ogDescription} />
      </Helmet>

      <HeroSection />

      {/* Statistics Section */}
      <section className="bg-dark-card py-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {statsDisplay.map((stat, index) => (
              <StatCard key={index} {...stat} loading={loading} />
            ))}
          </div>
        </div>
      </section>

      <FeaturesSection />

      {/* Categories Section */}
      <section className="bg-dark-card py-20">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-foreground">
              Categorías más reportadas
            </h2>
            <p className="text-lg text-foreground/70 max-w-2xl mx-auto">
              Ve qué tipos de objetos se reportan más frecuentemente en tu área.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category, index) => {
              const count = loading ? '...' : (categoryStats?.[category.name as keyof CategoryStats]?.toString() || '0')
              return <CategoryCard key={index} {...category} count={count} />
            })}
          </div>
        </div>
      </section>
    </div>
  )
}
