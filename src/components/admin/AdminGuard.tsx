import { useEffect, useState } from 'react'
import { AdminLogin } from '@/pages/admin/AdminLogin'

export function AdminGuard({ children }: { children: React.ReactNode }) {
    const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('safespot_admin_token')

            if (!token) {
                // Not logged in -> Show Login Component
                setIsAuthorized(false)
                return
            }

            try {
                // Verify token validity with backend
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/verify`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })

                if (res.ok) {
                    setIsAuthorized(true)
                } else {
                    // Invalid token -> Show Login Component
                    localStorage.removeItem('safespot_admin_token')
                    setIsAuthorized(false)
                }
            } catch (error) {
                // Network error or server down -> Safe fallback to Login
                setIsAuthorized(false)
            }
        }

        checkAuth()
    }, [])

    if (isAuthorized === null) {
        return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-[#00ff88]">Initializing Secure Environment...</div>
    }

    // If authorized, show the protected children (AdminLayout)
    if (isAuthorized) {
        return <>{children}</>
    }

    // If NOT authorized, show the Login Screen directly at the same URL
    // unless ghost protocol is required, but user asked for "entry at /admin"
    return <AdminLogin />
}
