import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HelmetProvider } from 'react-helmet-async'
import { AuthGuardProvider as AuthProvider } from '@/contexts/AuthGuardContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { ToastProvider } from '@/components/ui/toast'
import { ConfirmationProvider } from '@/components/ui/confirmation-manager'
import { AdminGuard } from './components/AdminGuard'

// Lazy loaded admin components
const AdminLayout = lazy(() => import('./layouts/AdminLayout').then(m => ({ default: m.AdminLayout })))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard').then(m => ({ default: m.AdminDashboard })))
const UsersPage = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })))
const AdminReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })))
const AdminModerationPage = lazy(() => import('./pages/ModerationPage').then(m => ({ default: m.ModerationPage })))
const AdminModerationHistoryPage = lazy(() => import('./pages/HistoryPage').then(m => ({ default: m.ModerationHistory })))
const AdminModerationDetailPage = lazy(() => import('./pages/ModerationActionDetailPage').then(m => ({ default: m.ModerationActionDetailPage })))
const AdminTasksPage = lazy(() => import('./pages/TasksPage').then(m => ({ default: m.TasksPage })))

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
})

export function AdminApp() {
    return (
        <QueryClientProvider client={queryClient}>
            <HelmetProvider>
                <AuthProvider>
                    <ThemeProvider>
                        <ToastProvider>
                            <ConfirmationProvider>
                                <BrowserRouter>
                                    <Routes>
                                        <Route path="/admin/*" element={
                                            <AdminGuard>
                                                <Suspense fallback={<div className="min-h-screen bg-[#020617] flex items-center justify-center text-[#00ff88]">Loading Admin Environment...</div>}>
                                                    <AdminLayout />
                                                </Suspense>
                                            </AdminGuard>
                                        }>
                                            <Route index element={<AdminDashboard />} />
                                            <Route path="reports" element={<AdminReportsPage />} />
                                            <Route path="users" element={<UsersPage />} />
                                            <Route path="moderation" element={<AdminModerationPage />} />
                                            <Route path="history" element={<AdminModerationHistoryPage />} />
                                            <Route path="history/:id" element={<AdminModerationDetailPage />} />
                                            <Route path="tasks" element={<AdminTasksPage />} />
                                        </Route>
                                        {/* Fallback to root or 404 */}
                                        <Route path="*" element={<Navigate to="/admin" replace />} />
                                    </Routes>
                                </BrowserRouter>
                            </ConfirmationProvider>
                        </ToastProvider>
                    </ThemeProvider>
                </AuthProvider>
            </HelmetProvider>
        </QueryClientProvider>
    )
}
