import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin } from 'lucide-react'

export function AdminLogin() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })

            const data = await res.json()

            if (res.ok && data.token) {
                localStorage.setItem('safespot_admin_token', data.token)
                localStorage.setItem('safespot_admin_user', JSON.stringify(data.user))
                // Reload to re-trigger Guard check and render Layout
                window.location.href = '/admin'
            } else {
                alert('Credenciales inválidas')
            }
        } catch (error) {
            console.error('Login failed', error)
            alert('Error de conexión')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 bg-[#0f172a] p-8 rounded-xl border border-[#1e293b] shadow-2xl relative overflow-hidden">
                {/* Neon Glow Decoration */}
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff88] to-transparent opacity-50"></div>

                <div className="flex flex-col items-center">
                    <div className="h-16 w-16 bg-[#00ff88]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#00ff88]/20 animate-pulse">
                        <MapPin className="h-8 w-8 text-[#00ff88]" />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Console Access</h2>
                    <p className="text-slate-400 text-sm mt-2">Restricted Area. Authorized Personnel Only.</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleLogin}>
                    <div className="space-y-4">
                        <div>
                            <Input
                                type="email"
                                placeholder="Operative ID"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="bg-[#1e293b] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#00ff88] focus:ring-[#00ff88]/20"
                            />
                        </div>
                        <div>
                            <Input
                                type="password"
                                placeholder="Access Key"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="bg-[#1e293b] border-[#334155] text-white placeholder:text-slate-500 focus:border-[#00ff88] focus:ring-[#00ff88]/20"
                            />
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-[#00ff88] text-[#020617] hover:bg-[#00cc6a] font-bold tracking-wide"
                    >
                        {loading ? 'Authenticating...' : 'INITIALIZE SESSION'}
                    </Button>
                </form>

                <div className="text-center pt-4">
                    <p className="text-xs text-slate-600 font-mono">
                        SYSTEM SECURE // ENCRYPTED CONNECTION
                    </p>
                </div>
            </div>
        </div>
    )
}
