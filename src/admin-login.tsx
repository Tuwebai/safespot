import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AdminLogin } from './pages/auth/AdminLogin'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AdminThemeProvider } from './admin/contexts/AdminThemeContext'
import { ToastProvider } from './components/ui/toast'
import './index.css'

const queryClient = new QueryClient({
    defaultOptions: {
        queries: { retry: 1, refetchOnWindowFocus: false },
    },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <AdminThemeProvider>
                <ToastProvider>
                    <AdminLogin />
                </ToastProvider>
            </AdminThemeProvider>
        </QueryClientProvider>
    </StrictMode>,
)
