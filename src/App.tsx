import { Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RouteLoadingFallback, DetailLoadingFallback } from '@/components/RouteLoadingFallback'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import { ConfirmationProvider } from '@/components/ui/confirmation-manager'
import { lazyRetry } from '@/lib/lazyRetry'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { HelmetProvider } from 'react-helmet-async'
import { ToastProvider } from '@/components/ui/toast'
import { PushNotificationListener } from '@/components/PushNotificationListener'
import { PushNotificationInitializer } from '@/components/PushNotificationInitializer'

// ✅ ENTERPRISE: Anti-Infinite Loading Guards
import { GlobalErrorBoundary } from '@/components/GlobalErrorBoundary'
import { StartupGuard } from '@/components/StartupGuard'

// ✅ PERFORMANCE FIX: Leaflet icons initialization moved to Explorar.tsx
// This prevents loading Leaflet library (~200KB) in the main bundle


// Lazy-loaded page components with retry logic to avoid 404 chunk errors
const Home = lazyRetry(() => import('@/pages/Home').then(m => ({ default: m.Home })), 'Home')
const Reportes = lazyRetry(() => import('@/pages/Reportes').then(m => ({ default: m.Reportes })), 'Reportes')
// ✅ WIZARD: Nuevo flujo de creación de reportes por pasos
const ReportWizard = lazyRetry(() => import('@/components/report-wizard').then(m => ({ default: m.ReportWizard })), 'ReportWizard')
// 🔒 LEGACY: Componente antiguo preservado por compatibilidad (no usado actualmente)
// const CrearReporte = lazyRetry(() => import('@/pages/CrearReporte').then(m => ({ default: m.CrearReporte })), 'CrearReporte')
const DetalleReporte = lazyRetry(() => import('@/pages/DetalleReporte').then(m => ({ default: m.DetalleReporte })), 'DetalleReporte')
// ✅ PERFORMANCE FIX: Lazy load Explorar to avoid loading Leaflet (200KB) in main bundle
// Leaflet icons are initialized inside Explorar.tsx when the map component loads
const Explorar = lazyRetry(() => import('@/pages/Explorar').then(m => ({ default: m.Explorar })), 'Explorar')
const Gamificacion = lazyRetry(() => import('@/pages/Gamificacion').then(m => ({ default: m.Gamificacion })), 'Gamificacion')
const Perfil = lazyRetry(() => import('@/pages/Perfil').then(m => ({ default: m.Perfil })), 'Perfil')
const SettingsPage = lazyRetry(() => import('@/pages/profile/SettingsPage').then(m => ({ default: m.SettingsPage })), 'SettingsPage')
const MisFavoritos = lazyRetry(() => import('@/pages/MisFavoritos').then(m => ({ default: m.MisFavoritos })), 'MisFavoritos')
const ZoneAlertsPage = lazyRetry(() => import('@/pages/ZoneAlertsPage').then(m => ({ default: m.ZoneAlertsPage })), 'ZoneAlertsPage')
const TerminosPage = lazyRetry(() => import('@/pages/TerminosPage'), 'Terminos')
const PrivacidadPage = lazyRetry(() => import('@/pages/PrivacidadPage'), 'Privacidad')
const AboutPage = lazyRetry(() => import('@/pages/AboutPage'), 'About')
const NotificationsPage = lazyRetry(() => import('@/pages/NotificationsPage'), 'Notifications')
const PublicProfile = lazyRetry(() => import('@/pages/PublicProfile').then(m => ({ default: m.PublicProfile })), 'PublicProfile')
const FollowsPage = lazyRetry(() => import('@/pages/FollowsPage').then(m => ({ default: m.default })), 'FollowsPage')
const ThreadPage = lazyRetry(() => import('./pages/ThreadPage').then(m => ({ default: m.ThreadPage })), 'ThreadPage')
const Mensajes = lazyRetry(() => import('@/pages/Mensajes'), 'Mensajes')
const Comunidad = lazyRetry(() => import('@/pages/Comunidad').then(m => ({ default: m.Comunidad })), 'Comunidad')
const ResetPassword = lazyRetry(() => import('@/pages/ResetPassword'), 'ResetPassword')
const SystemStatus = lazyRetry(() => import('@/pages/SystemStatus').then(m => ({ default: m.SystemStatus })), 'SystemStatus')
const CookiesPolicy = lazyRetry(() => import('@/pages/CookiesPolicy').then(m => ({ default: m.CookiesPolicy })), 'CookiesPolicy')
const WeeklySummaryPage = lazyRetry(() => import('@/pages/WeeklySummaryPage').then(m => ({ default: m.WeeklySummaryPage })), 'WeeklySummaryPage')

// Product Pages
const ComoFuncionaPage = lazyRetry(() => import('@/pages/ComoFuncionaPage'), 'ComoFunciona')
const FaqPage = lazyRetry(() => import('@/pages/FaqPage'), 'Faq')
const GuiaSeguridadSimple = lazyRetry(() => import('@/pages/GuiaSeguridadSimple'), 'GuiaSeguridad')
const AuthPage = lazyRetry(() => import('@/pages/AuthPage'), 'AuthPage')
const RoboPiranaPage = lazyRetry(() => import('@/pages/intel/RoboPiranaPage').then(m => ({ default: m.RoboPiranaPage })), 'RoboPiranaPage')
const CorredoresSegurosPage = lazyRetry(() => import('@/pages/intel/CorredoresSegurosPage').then(m => ({ default: m.CorredoresSegurosPage })), 'CorredoresSegurosPage')
const NocturnaPage = lazyRetry(() => import('@/pages/intel/NocturnaPage').then(m => ({ default: m.NocturnaPage })), 'NocturnaPage')
const EstafasPage = lazyRetry(() => import('@/pages/guia/EstafasPage'), 'EstafasPage')
const TransportePage = lazyRetry(() => import('@/pages/guia/TransportePage'), 'TransportePage')
const BancosPage = lazyRetry(() => import('@/pages/guia/BancosPage'), 'BancosPage')
const MascotasPage = lazyRetry(() => import('@/pages/guia/MascotasPage'), 'MascotasPage')
const GeneroPage = lazyRetry(() => import('@/pages/guia/GeneroPage'), 'GeneroPage')
const DenunciaPage = lazyRetry(() => import('@/pages/guia/DenunciaPage'), 'DenunciaPage')
const ProtocoloTestigoPage = lazyRetry(() => import('@/pages/guia/ProtocoloTestigoPage'), 'ProtocoloTestigoPage')
const PrediccionPage = lazyRetry(() => import('@/pages/guia/PrediccionPage'), 'PrediccionPage')
const ManualUrbanoPage = lazyRetry(() => import('@/pages/guia/ManualUrbanoPage'), 'ManualUrbanoPage')
const TransparenciaPage = lazyRetry(() => import('@/pages/guia/TransparenciaPage'), 'TransparenciaPage')
const BlogPage = lazyRetry(() => import('@/pages/BlogPage'), 'BlogPage')
const BlogPostPage = lazyRetry(() => import('@/pages/BlogPostPage'), 'BlogPostPage')

import { ThemeProvider } from '@/contexts/ThemeContext'
import { FirstTimeOnboardingTheme } from '@/components/onboarding/FirstTimeOnboardingTheme'

import { SEO } from '@/components/SEO'

import { AuthToastListener } from '@/components/auth/AuthToastListener'

import { GoogleOAuthProvider } from '@react-oauth/google';

// ✅ ENTERPRISE: Auth Guard System
import { AuthGuardProvider, useAuthGuardContext } from '@/contexts/AuthGuardContext'
import { AuthRequiredModal } from '@/components/auth/AuthRequiredModal'

function App() {
  // SafeSpot Google Client ID (Must be in .env, fallback for dev safety)
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PENDING_CLIENT_ID';

  // ✅ ENTERPRISE FIX: Reconnection Handler
  // Auto-refetch active queries when network returns from offline
  useEffect(() => {
    // 1. BOOT STRATEGY: Invalidate everything on mount to clear "stale" in-memory state
    // This pairs with SecureBoot (which clears storage) to guarantee 100% freshness.
    // console.debug('[App] 🚀 Booting... Invalidating all queries.');

    // ⚠️ ENTERPRISE FIX: DISABLED GLOBAL INVALIDATION 
    // This caused a "Request Storm" (429 Too Many Requests) on boot. 
    // We rely on `staleTime: 60s` and `refetchOnMount: true` instead.
    // queryClient.invalidateQueries();

    const handleOnline = () => {
      // console.debug('[App] ✅ Network restored → refetching active queries');
      queryClient.refetchQueries({ type: 'active', stale: true });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);



  return (
    <GlobalErrorBoundary>
      <HelmetProvider>
        <QueryClientProvider client={queryClient}>
          <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
            <BrowserRouter
              future={{
                v7_startTransition: true,
                v7_relativeSplatPath: true,
              }}
            >
              <PushNotificationListener />
              {/* ✅ ENTERPRISE: Auth Guard Provider envuelve toda la app */}
              <StartupGuard>
                <AuthGuardProvider>
                  <ToastProvider>
                    <PushNotificationInitializer />
                    <ThemeProvider>
                      <ConfirmationProvider>
                        <FirstTimeOnboardingTheme />
                        <SEO />
                        <Layout>
                          <ChunkErrorBoundary>
                            <Suspense fallback={<RouteLoadingFallback />}>
                              <AuthToastListener />
                              <Routes>
                                <Route path="/" element={<Home />} />
                                <Route path="/reportes" element={<Reportes />} />
                                <Route path="/crear-reporte" element={<ReportWizard />} />
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
                                <Route path="/reset-password" element={<ResetPassword />} />
                                <Route path="/ajustes" element={<SettingsPage />} />
                                <Route path="/favoritos" element={<MisFavoritos />} />
                                <Route path="/comunidad" element={<Comunidad />} />
                                <Route path="/alertas/:zoneSlug" element={<ZoneAlertsPage />} />
                                <Route path="/notificaciones" element={<NotificationsPage />} />
                                <Route path="/terminos" element={<TerminosPage />} />
                                <Route path="/privacidad" element={<PrivacidadPage />} />
                                <Route path="/como-funciona" element={<ComoFuncionaPage />} />
                                <Route path="/faq" element={<FaqPage />} />
                                <Route path="/guia-seguridad" element={<GuiaSeguridadSimple />} />
                                <Route path="/login" element={<AuthPage />} />
                                <Route path="/register" element={<AuthPage />} />

                                {/* Safety Intel Routes */}
                                {/* Safety Intel Routes (Standardized SEO) */}
                                <Route path="/intel/protocolo-anti-pirana" element={<RoboPiranaPage />} />
                                <Route path="/intel/cuento-del-tio-ciberdelito" element={<EstafasPage />} />
                                <Route path="/intel/viaja-pillo-transporte" element={<TransportePage />} />
                                <Route path="/intel/ojo-en-el-cajero" element={<BancosPage />} />
                                <Route path="/intel/perdiste-al-firu" element={<MascotasPage />} />
                                <Route path="/intel/violencia-de-genero" element={<GeneroPage />} />
                                <Route path="/intel/habla-sin-miedo" element={<DenunciaPage />} />

                                {/* Intel Advanced */}
                                <Route path="/intel/protocolo-testigo" element={<ProtocoloTestigoPage />} />
                                <Route path="/intel/prediccion-del-delito" element={<PrediccionPage />} />
                                <Route path="/intel/manual-urbano" element={<ManualUrbanoPage />} />

                                {/* System Trust */}
                                <Route path="/confianza/sistema-de-confianza" element={<TransparenciaPage />} />

                                <Route path="/intel/corredores-seguros" element={<CorredoresSegurosPage />} />
                                <Route path="/intel/nocturna" element={<NocturnaPage />} />

                                <Route path="/blog" element={<BlogPage />} />
                                <Route path="/blog/:slug" element={<BlogPostPage />} />

                                <Route path="/sobre-nosotros" element={<AboutPage />} />
                                <Route path="/usuario/:alias" element={<PublicProfile />} />
                                <Route path="/usuario/:alias/seguidores" element={<FollowsPage />} />
                                <Route path="/usuario/:alias/seguidos" element={<FollowsPage />} />
                                <Route path="/usuario/:alias/sugerencias" element={<FollowsPage />} />
                                <Route path="/usuario/:alias/sugerencias" element={<FollowsPage />} />
                                <Route path="/reporte/:reportId/hilo/:commentId" element={<ThreadPage />} />
                                <Route path="/mensajes/:roomId?" element={<Mensajes />} />

                                {/* Enterprise Security Pages */}
                                <Route path="/status" element={<SystemStatus />} />
                                <Route path="/cookies" element={<CookiesPolicy />} />

                                {/* Retention Features */}
                                <Route path="/weekly-summary" element={<WeeklySummaryPage />} />

                                {/* --- ADMIN ROUTES (Protected by Guard) --- */}
                                {/* 
                      Ghost Protocol Logic Update: 
                      User requested "/admin" to be the entry. 
                      - If unauthorized -> Show Login Screen (at /admin).
                      - If authorized -> Show Admin Layout (at /admin).
                      We will handle this in a wrapper component. 
                  */}
                                {/* Admin routes moved to separated AdminApp bundle for segmentation security override */}


                              </Routes>
                            </Suspense>
                          </ChunkErrorBoundary >
                        </Layout >
                      </ConfirmationProvider>
                    </ThemeProvider>
                  </ToastProvider>

                  {/* ✅ ENTERPRISE: Modal global - UNA SOLA INSTANCIA */}
                  <GlobalAuthModal />
                </AuthGuardProvider>
              </StartupGuard>
            </BrowserRouter >
          </GoogleOAuthProvider>
        </QueryClientProvider>
      </HelmetProvider>
    </GlobalErrorBoundary>
  )
}


/**
 * Helper component para montar el modal global
 * Lee el estado del AuthGuardContext
 */
function GlobalAuthModal() {
  const { isModalOpen, closeModal } = useAuthGuardContext();
  return <AuthRequiredModal isOpen={isModalOpen} onClose={closeModal} />;
}

export default App
