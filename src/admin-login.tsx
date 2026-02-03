import { StrictMode } from 'react'
import ReactDOM from 'react-dom/client'
import { AdminLogin } from './pages/auth/AdminLogin'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/ui/toast'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <ThemeProvider>
            <ToastProvider>
                <AdminLogin />
            </ToastProvider>
        </ThemeProvider>
    </StrictMode>,
)
