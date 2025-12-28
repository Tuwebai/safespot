import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RouteLoadingFallback, DetailLoadingFallback } from '@/components/RouteLoadingFallback'

// Lazy-loaded page components
// Each page is loaded only when navigated to, reducing initial bundle size
const Home = lazy(() => import('@/pages/Home').then(m => ({ default: m.Home })))
const Reportes = lazy(() => import('@/pages/Reportes').then(m => ({ default: m.Reportes })))
const CrearReporte = lazy(() => import('@/pages/CrearReporte').then(m => ({ default: m.CrearReporte })))
const DetalleReporte = lazy(() => import('@/pages/DetalleReporte').then(m => ({ default: m.DetalleReporte })))
const Explorar = lazy(() => import('@/pages/Explorar').then(m => ({ default: m.Explorar })))
const Gamificacion = lazy(() => import('@/pages/Gamificacion').then(m => ({ default: m.Gamificacion })))
const Perfil = lazy(() => import('@/pages/Perfil').then(m => ({ default: m.Perfil })))
const MisFavoritos = lazy(() => import('@/pages/MisFavoritos').then(m => ({ default: m.MisFavoritos })))
const TerminosPage = lazy(() => import('@/pages/TerminosPage'))
const PrivacidadPage = lazy(() => import('@/pages/PrivacidadPage'))

function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <Layout>
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
            <Route path="/terminos" element={<TerminosPage />} />
            <Route path="/privacidad" element={<PrivacidadPage />} />
          </Routes>
        </Suspense>
      </Layout>
    </BrowserRouter>
  )
}

export default App
