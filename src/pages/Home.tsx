import { memo } from 'react'
import { Link } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { RippleButton } from '@/components/ui/RippleButton'
import { MapPin, Shield, Users, Eye, TrendingUp, CheckCircle } from 'lucide-react'
import type { CategoryStats } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useGlobalStatsQuery, useCategoryStatsQuery } from '@/hooks/queries'
import { SEO } from '@/components/SEO'

// ============================================
// MEMOIZED SUB-COMPONENTS
// ============================================

const HeroSection = memo(() => (
  <section className="relative bg-gradient-to-br from-dark-bg via-dark-card to-dark-bg py-12 md:py-24 lg:py-32">
    <div
      className="absolute inset-0 opacity-20"
      style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2300ff88' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
      }}
    />
    <div className="container relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="text-center animate-fade-in">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-bold mb-6 text-foreground tracking-tight">
          Tu zona segura,{' '}
          <span className="gradient-text">siempre</span>
        </h1>
        <p className="text-lg md:text-xl text-foreground/70 max-w-3xl mx-auto mb-8">
          SafeSpot es la plataforma colaborativa que te ayuda a reportar robos y recuperar objetos robados junto con tu comunidad.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link to="/crear-reporte" className="w-full sm:w-auto">
            <RippleButton
              variant="neon"
              className="w-full sm:px-8 py-6 text-lg h-auto neon-glow"
              rippleColor="rgba(57, 255, 20, 0.6)"
            >
              <MapPin className="mr-2 h-5 w-5" />
              Crear Reporte
            </RippleButton>
          </Link>
          <Link to="/explorar" className="w-full sm:w-auto">
            <RippleButton
              variant="outline"
              className="w-full sm:px-8 py-6 text-lg h-auto border-neon-green text-neon-green hover:bg-neon-green/10"
              rippleColor="rgba(57, 255, 20, 0.3)"
            >
              <Eye className="mr-2 h-5 w-5" />
              Ver Mapa
            </RippleButton>
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
  <Card className="bg-dark-card border-dark-border hover:border-neon-green/30 transition-all group overflow-hidden">
    <CardContent className="p-6">
      <div className="p-3 bg-neon-green/10 rounded-xl w-fit mb-4 group-hover:scale-110 transition-transform">
        <Icon className="w-6 h-6 text-neon-green" />
      </div>
      <h3 className="text-xl font-bold mb-2 text-foreground">{title}</h3>
      <p className="text-foreground/60 text-sm leading-relaxed">{description}</p>
    </CardContent>
  </Card>
))

const FeaturesSection = memo(() => {
  const features = [
    // ... features list unchanged ...
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
    <section className="bg-dark-bg py-12 md:py-20">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-foreground">
            ¿Por qué elegir SafeSpot?
          </h2>
          <p className="text-base md:text-lg text-foreground/70 max-w-2xl mx-auto">
            Nuestra plataforma está diseñada para hacer que reportar robos sea fácil, seguro y efectivo.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <FeatureCard key={index} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
})

const StatCard = memo(({ label, value, icon: Icon, color, loading }: { label: string, value: string, icon: any, color: string, loading: boolean }) => (
  <Card className="bg-dark-bg/50 border-dark-border overflow-hidden">
    <CardContent className="p-6 flex items-center gap-4">
      <div className={cn("p-4 rounded-xl", color.replace('text-', 'bg-').concat('/10'))}>
        <Icon className={cn("w-6 h-6", color)} />
      </div>
      <div>
        <p className="text-sm text-foreground/50 font-medium">{label}</p>
        {loading ? (
          <Skeleton className="h-8 w-16 mt-1" />
        ) : (
          <p className="text-2xl font-bold text-foreground">{value}</p>
        )}
      </div>
    </CardContent>
  </Card>
))

const CategoryCard = memo(({ name, color, count }: { name: string, color: string, count: string | number }) => (
  <div className="bg-dark-bg/50 border border-dark-border p-6 rounded-2xl flex items-center justify-between group hover:border-neon-green/20 transition-all">
    <div className="flex items-center gap-4">
      <div className={cn("w-3 h-3 rounded-full", color)} />
      <span className="text-lg font-medium text-foreground">{name}</span>
    </div>
    <span className="text-2xl font-bold text-neon-green">{count}</span>
  </div>
))

// ============================================
// MAIN PAGE COMPONENT
// ============================================

export function Home() {
  // ... hooks unchanged ...
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
  ]

  const categories = [
    { name: 'Celulares', color: 'bg-blue-500' },
    { name: 'Bicicletas', color: 'bg-green-500' },
    { name: 'Motos', color: 'bg-yellow-500' },
    { name: 'Autos', color: 'bg-red-500' },
    { name: 'Laptops', color: 'bg-purple-500' },
    { name: 'Carteras', color: 'bg-pink-500' },
  ]

  return (
    <div className="min-h-screen bg-dark-bg">
      <SEO
        title="Reportar Robo y Ver Reportes - SafeSpot Mapas de Seguridad"
        description="La mejor plataforma para reportar robos y ver reportes en tiempo real. Únete a la comunidad de reportar incidentes SafeSpot."
        type="website"
      />

      <HeroSection />

      {/* Statistics Section */}
      <section className="bg-dark-card py-12 md:py-16">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {statsDisplay.map((stat, index) => (
              <StatCard key={index} {...stat} loading={loading} />
            ))}
          </div>
        </div>
      </section>

      <FeaturesSection />

      {/* Categories Section */}
      <section className="bg-dark-card py-12 md:py-20 lg:py-24">
        <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold mb-4 text-foreground">
              Categorías más reportadas
            </h2>
            <p className="text-base md:text-lg text-foreground/70 max-w-2xl mx-auto">
              Ve qué tipos de objetos se reportan más frecuentemente en tu área.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
