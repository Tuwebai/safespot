import { SEO } from '@/components/SEO'
import { HomeOrchestrator } from '@/components/home/HomeOrchestrator'

// ============================================
// MAIN PAGE COMPONENT - REDESIGN ORCHESTRATOR
// ============================================

export function Home() {
  return (
    <>
      <SEO
        title="Red de Seguridad Colaborativa - SafeSpot"
        description="Plataforma de vigilancia comunitaria y recuperación de objetos. Reportá incidentes, protegé tu zona y colaborá con tus vecinos en tiempo real."
        type="website"
      />
      <HomeOrchestrator />
    </>
  );
}
