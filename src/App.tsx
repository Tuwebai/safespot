import { Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from '@/components/layout/Layout'
import { RouteLoadingFallback, DetailLoadingFallback } from '@/components/RouteLoadingFallback'
import { ChunkErrorBoundary } from '@/components/ChunkErrorBoundary'
import { lazyRetry } from '@/lib/lazyRetry'
import { useQueryClient } from '@tanstack/react-query'


// Lazy-loaded page components with retry logic to avoid 404 chunk errors
const Home = lazyRetry(() => import('@/pages/Home').then(m => ({ default: m.Home })), 'Home')
const Reportes = lazyRetry(() => import('@/pages/Reportes').then(m => ({ default: m.Reportes })), 'Reportes')
const CrearReporte = lazyRetry(() => import('@/pages/CrearReporte').then(m => ({ default: m.CrearReporte })), 'CrearReporte')
const DetalleReporte = lazyRetry(() => import('@/pages/DetalleReporte').then(m => ({ default: m.DetalleReporte })), 'DetalleReporte')
// Explorar convertido a import estático para corregir error de Hooks/Context
import { Explorar } from '@/pages/Explorar'
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

// Product Pages
const ComoFuncionaPage = lazyRetry(() => import('@/pages/ComoFuncionaPage'), 'ComoFunciona')
const FaqPage = lazyRetry(() => import('@/pages/FaqPage'), 'Faq')
const GuiaSeguridadSimple = lazyRetry(() => import('@/pages/GuiaSeguridadSimple'), 'GuiaSeguridad')
const AuthPage = lazyRetry(() => import('@/pages/AuthPage'), 'AuthPage')

// Admin Imports (Lazy Loaded)
const AdminLayout = lazyRetry(() => import('@/components/layout/AdminLayout').then(m => ({ default: m.AdminLayout })), 'AdminLayout')

const AdminDashboard = lazyRetry(() => import('@/pages/admin/AdminDashboard').then(m => ({ default: m.AdminDashboard })), 'AdminDashboard')
const UsersPage = lazyRetry(() => import('@/pages/admin/UsersPage').then(m => ({ default: m.UsersPage })), 'UsersPage')
const AdminReportsPage = lazyRetry(() => import('./pages/admin/ReportsPage').then(module => ({ default: module.ReportsPage })), 'AdminReportsPage')
const AdminModerationPage = lazyRetry(() => import('@/pages/admin/ModerationPage').then(m => ({ default: m.ModerationPage })), 'AdminModerationPage')
const AdminTasksPage = lazyRetry(() => import('@/pages/admin/TasksPage').then(m => ({ default: m.TasksPage })), 'AdminTasksPage')
import { AdminGuard } from '@/components/admin/AdminGuard'

import { ThemeProvider } from '@/contexts/ThemeContext'
import { FirstTimeOnboardingTheme } from '@/components/onboarding/FirstTimeOnboardingTheme'

import { SEO } from '@/components/SEO'

import { AuthToastListener } from '@/components/auth/AuthToastListener'

import { GoogleOAuthProvider } from '@react-oauth/google';

function App() {
  // SafeSpot Google Client ID (Must be in .env, fallback for dev safety)
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || 'PENDING_CLIENT_ID';
  const queryClient = useQueryClient();

  // ✅ ENTERPRISE FIX: Reconnection Handler
  // Auto-refetch active queries when network returns from offline
  useEffect(() => {
    const handleOnline = () => {
      console.log('[App] ✅ Network restored → refetching active queries');
      queryClient.refetchQueries({ type: 'active', stale: true });
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [queryClient]);



  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ThemeProvider>

          <FirstTimeOnboardingTheme />

          <SEO />
          <Layout>
            <ChunkErrorBoundary>
              <Suspense fallback={<RouteLoadingFallback />}>
                <AuthToastListener />
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
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route path="/perfil/configuracion" element={<SettingsPage />} />
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
                  <Route path="/sobre-nosotros" element={<AboutPage />} />
                  <Route path="/usuario/:alias" element={<PublicProfile />} />
                  <Route path="/usuario/:alias/seguidores" element={<FollowsPage />} />
                  <Route path="/usuario/:alias/seguidos" element={<FollowsPage />} />
                  <Route path="/usuario/:alias/sugerencias" element={<FollowsPage />} />
                  <Route path="/reporte/:reportId/hilo/:commentId" element={<ThreadPage />} />
                  <Route path="/mensajes/:roomId?" element={<Mensajes />} />

                  {/* --- ADMIN ROUTES (Protected by Guard) --- */}
                  {/* 
                    Ghost Protocol Logic Update: 
                    User requested "/admin" to be the entry. 
                    - If unauthorized -> Show Login Screen (at /admin).
                    - If authorized -> Show Admin Layout (at /admin).
                    We will handle this in a wrapper component. 
                */}
                  <Route path="/admin/*" element={
                    <AdminGuard>
                      <AdminLayout />
                    </AdminGuard>
                  }>
                    <Route index element={<AdminDashboard />} />
                    <Route path="reports" element={<AdminReportsPage />} />
                    <Route path="users" element={<UsersPage />} />
                    <Route path="moderation" element={<AdminModerationPage />} />
                    <Route path="tasks" element={<AdminTasksPage />} />
                    {/* Add other admin sub-routes here */}
                  </Route>

                </Routes>
              </Suspense>
            </ChunkErrorBoundary>
          </Layout>
        </ThemeProvider>
      </BrowserRouter >
    </GoogleOAuthProvider>
  )
}

export default App
