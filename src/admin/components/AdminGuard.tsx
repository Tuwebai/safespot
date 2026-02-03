import { useEffect, useState } from 'react'

export function AdminGuard({ children }: { children: React.ReactNode }) {
    const [status, setStatus] = useState<'loading' | 'authorized' | 'unauthorized' | 'forbidden'>('loading')


    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('safespot_admin_token')

            if (!token) {
                setStatus('unauthorized')
                return
            }

            try {
                // 🧹 TOKEN HYGIENE: Pre-validate format to prevent 400 Bad Request
                const parts = token.split('.')
                if (parts.length !== 3) {
                    throw new Error('Malformed Token Structure')
                }

                // Verify token validity with backend
                const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/admin/auth/verify`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                })

                if (res.status === 403) {
                    setStatus('forbidden')
                    return
                }

                if (!res.ok) {
                    throw new Error('Verification failed')
                }

                const contentType = res.headers.get('content-type')
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Invalid content type (SPA Fallback Trap)')
                }

                const data = await res.json()
                if (data.valid) {
                    if (data.user) {
                        localStorage.setItem('safespot_admin_user', JSON.stringify(data.user))
                    }
                    setStatus('authorized')
                } else {
                    throw new Error('Token invalid')
                }
            } catch (error) {
                console.warn('[AdminGuard] Security Check Failed:', error)
                localStorage.removeItem('safespot_admin_token')
                localStorage.removeItem('safespot_admin_user')
                setStatus('unauthorized')
            }
        }

        checkAuth()
    }, [])

    if (status === 'loading') {
        return <div className="min-h-screen bg-[#020617] flex items-center justify-center text-[#00ff88] font-mono tracking-widest animate-pulse">
            Establishing Secure Uplink...
        </div>
    }

    if (status === 'authorized') {
        return <>{children}</>
    }

    if (status === 'forbidden') {
        return (
            <div className="min-h-screen bg-[#020617] flex flex-col items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6">
                    <div className="h-20 w-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto border border-red-500/20">
                        <span className="text-red-500 text-3xl font-bold">403</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Acceso Denegado</h2>
                    <p className="text-slate-400 text-sm">
                        Tu cuenta no tiene privilegios operativos para acceder a este sector.
                    </p>
                    <button
                        onClick={() => window.location.href = '/'}
                        className="text-[#00ff88] text-xs font-mono uppercase tracking-[0.2em] border border-[#00ff88]/20 px-4 py-2 rounded-lg hover:bg-[#00ff88]/5 transition-all"
                    >
                        Volver a la Terminal Pública
                    </button>
                </div>
            </div>
        )
    }

    // 🛡️ ZERO-TRUST FALLBACK: If unauthorized, we don't render Login here!
    // We redirect to the shell which will handle the public injection.
    // This prevents AdminApp from containing the Login logic.
    if (status === 'unauthorized') {
        window.location.href = '/admin'
        return null
    }

    return null
}

