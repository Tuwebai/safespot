import { Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RouteLoadingFallback, DetailLoadingFallback } from '@/components/RouteLoadingFallback'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import { lazyRetry } from '@/lib/lazyRetry'

// Lazy-loaded page components with retry logic to avoid 404 chunk errors
const Home = lazyRetry(() => import('@/pages/Home').then(m => ({ default: m.Home })), 'Home')
const Reportes = lazyRetry(() => import('@/pages/Reportes').then(m => ({ default: m.Reportes })), 'Reportes')
const CrearReporte = lazyRetry(() => import('@/pages/CrearReporte').then(m => ({ default: m.CrearReporte })), 'CrearReporte')
const DetalleReporte = lazyRetry(() => import('@/pages/DetalleReporte').then(m => ({ default: m.DetalleReporte })), 'DetalleReporte')
// Explorar convertido a import estático para corregir error de Hooks/Context
import { Explorar } from '@/pages/Explorar'
const Gamificacion = lazyRetry(() => import('@/pages/Gamificacion').then(m => ({ default: m.Gamificacion })), 'Gamificacion')
const Perfil = lazyRetry(() => import('@/pages/Perfil').then(m => ({ default: m.Perfil })), 'Perfil')
const MisFavoritos = lazyRetry(() => import('@/pages/MisFavoritos').then(m => ({ default: m.MisFavoritos })), 'MisFavoritos')
const ZoneAlertsPage = lazyRetry(() => import('@/pages/ZoneAlertsPage').then(m => ({ default: m.ZoneAlertsPage })), 'ZoneAlertsPage')
const TerminosPage = lazyRetry(() => import('@/pages/TerminosPage'), 'Terminos')
const PrivacidadPage = lazyRetry(() => import('@/pages/PrivacidadPage'), 'Privacidad')
const NotificationsPage = lazyRetry(() => import('@/pages/NotificationsPage'), 'Notifications')
const PublicProfile = lazyRetry(() => import('@/pages/PublicProfile').then(m => ({ default: m.PublicProfile })), 'PublicProfile')

import { ThemeProvider } from '@/contexts/ThemeContext'
import { FirstTimeOnboardingTheme } from '@/components/onboarding/FirstTimeOnboardingTheme'
import { UpdateNotification } from '@/components/UpdateNotification'

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ThemeProvider>
        <FirstTimeOnboardingTheme />
        <UpdateNotification />
        <Layout>
          <ChunkErrorBoundary>
            <Suspense fallback={<RouteLoadingFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/reportes" element={<Reportes />} />
                <Route path="/crear-reporte" element={<CrearReporte />} />
                <Route
                  path="/reporte/:id"
                  element={
                    <Suspense fallback={<DetailLoadingFallback />}>
                      <DetalleReporte />
                    </Suspense>
                  }
                />
                <Route path="/explorar" element={<Explorar />} />
                <Route path="/gamificacion" element={<Gamificacion />} />
                <Route path="/perfil" element={<Perfil />} />
                <Route path="/favoritos" element={<MisFavoritos />} />
                <Route path="/alertas/:zoneSlug" element={<ZoneAlertsPage />} />
                <Route path="/notificaciones" element={<NotificationsPage />} />
                <Route path="/terminos" element={<TerminosPage />} />
                <Route path="/privacidad" element={<PrivacidadPage />} />
                <Route path="/usuario/:alias" element={<PublicProfile />} />
              </Routes>
            </Suspense>
          </ChunkErrorBoundary>
        </Layout>
      </ThemeProvider>
    </BrowserRouter>
  )
}

export default App
