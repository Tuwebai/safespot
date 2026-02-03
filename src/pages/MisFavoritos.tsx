import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Star, AlertCircle } from 'lucide-react'
import { useFavoritesQuery } from '@/hooks/queries/useProfileQuery'
import { ReportCardSkeleton } from '@/components/ui/skeletons'
import { EmptyState } from '@/components/ui/empty-state'
import { ReportCard } from '@/components/ReportCard'

export function MisFavoritos() {

  /**
   * ⚠️ ARQUITECTURA (SafeSpot - Feb 2026):
   * Se elimina la virtualización manual por filas que rompía la responsividad.
   * Se utiliza un grid nativo de Tailwind para garantizar alineación y centrado.
   */
  const navigate = useNavigate()
  const { data: reports = [], isLoading, error, refetch } = useFavoritesQuery()

  const handleFavoriteToggle = () => {
    // Re-fetch or rely on SSOT cache (ReportCard handles its own state)
    refetch()
  }

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2 text-center sm:text-left">Mis Favoritos</h1>
          <p className="text-foreground/70 text-center sm:text-left">Cargando colección estelar...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ReportCardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="bg-dark-card border-dark-border max-w-md">
            <CardContent className="p-6 text-center">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Error al cargar favoritos</h2>
              <p className="text-foreground/70 mb-4">{error instanceof Error ? error.message : 'Error desconocido'}</p>
              <Button
                onClick={() => refetch()}
                className="bg-neon-green hover:bg-neon-green/90 text-dark-bg"
              >
                Reintentar
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (reports.length === 0) {
    return (
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Mis Favoritos</h1>
          <p className="text-foreground/70">Colección de reportes guardados</p>
        </div>

        <EmptyState
          variant="default"
          icon={Star}
          title="Aún no tienes favoritos"
          description="Guarda los reportes que te interesan para hacerles seguimiento rápido. Aparecerán aquí."
          action={{
            label: "Explorar Reportes",
            onClick: () => navigate('/reportes'),
            variant: "neon"
          }}
          className="bg-card/30 border border-dashed border-border rounded-xl"
        />
      </div>
    )
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
      <div className="mb-8 text-center sm:text-left">
        <h1 className="text-3xl font-bold gradient-text mb-2">Mis Favoritos</h1>
        <p className="text-foreground/70 transition-all duration-300">
          {reports.length} {reports.length === 1 ? 'reporte guardado' : 'reportes guardados'}
        </p>
      </div>

      {/* ✅ GRID RESPONSIVO CORRECTO (SSOT + Enterprise UI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
        {reports.map((report) => (
          <ReportCard
            key={report.id}
            reportId={report.id}
            onToggleFavorite={handleFavoriteToggle}
            onFlag={(e) => {
              // En favoritos no habilitamos flag directo para no sobrecargar
              e.preventDefault();
            }}
          />
        ))}
      </div>
    </div>
  )
}
