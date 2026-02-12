import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { MapPin, Shield, KeyRound, ArrowLeft } from 'lucide-react'
import { useToast } from '@/components/ui/toast/useToast'

type LoginStep = 'credentials' | '2fa'

export function AdminLogin() {
    // Credentials
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    
    // 2FA
    const [step, setStep] = useState<LoginStep>('credentials')
    const [tempToken, setTempToken] = useState('')
    const [code, setCode] = useState('')
    const [user, setUser] = useState<{ id: string; email: string; role: string; alias: string } | null>(null)
    
    const [loading, setLoading] = useState(false)
    const { error: showError, success: showSuccess } = useToast()

    // Step 1: Validate credentials
    const handleCredentials = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            })

            const data = await res.json()

            if (!res.ok) {
                showError(data.error || 'Credenciales inválidas')
                return
            }

            // Check if 2FA is required
            if (data.requires2FA) {
                setTempToken(data.tempToken)
                setUser(data.user)
                setStep('2fa')
                showSuccess('Código 2FA requerido')
            } else {
                // Complete login
                completeLogin(data.token, data.user)
            }
        } catch (error) {
            console.error('Login failed', error)
            showError('Error de conexión con el servidor')
        } finally {
            setLoading(false)
        }
    }

    // Step 2: Verify 2FA code
    const handle2FAVerify = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/auth/verify-2fa`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tempToken, code: code.replace(/\s/g, '') })
            })

            const data = await res.json()

            if (!res.ok) {
                showError(data.error || 'Código inválido')
                return
            }

            // Complete login
            completeLogin(data.token, data.user)
        } catch (error) {
            console.error('2FA verification failed', error)
            showError('Error de conexión con el servidor')
        } finally {
            setLoading(false)
        }
    }

    const completeLogin = (token: string, userData: typeof user) => {
        localStorage.setItem('safespot_admin_token', token)
        localStorage.setItem('safespot_admin_user', JSON.stringify(userData))
        window.location.href = '/admin'
    }

    const goBack = () => {
        setStep('credentials')
        setTempToken('')
        setCode('')
        setUser(null)
    }

    // Render 2FA Step
    if (step === '2fa') {
        return (
            <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
                <div className="max-w-md w-full space-y-8 bg-[#0f172a] px-4 sm:px-8 py-8 rounded-xl border border-[#1e293b] shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff88] to-transparent opacity-50"></div>

                    <div className="flex flex-col items-center">
                        <div className="h-16 w-16 bg-[#00ff88]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#00ff88]/20">
                            <Shield className="h-8 w-8 text-[#00ff88]" />
                        </div>
                        <h2 className="text-2xl font-bold text-white tracking-tight">Verificación 2FA</h2>
                        <p className="text-slate-400 text-sm mt-2 text-center">
                            Ingresa el código de tu aplicación de autenticación
                        </p>
                        {user && (
                            <p className="text-emerald-400 text-xs mt-1 font-mono">
                                {user.alias || user.email}
                            </p>
                        )}
                    </div>

                    <form className="mt-8 space-y-6" onSubmit={handle2FAVerify}>
                        <div className="space-y-4">
                            <div className="relative">
                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                                <Input
                                    type="text"
                                    placeholder="000000"
                                    value={code}
                                    onChange={(e) => setCode(e.target.value)}
                                    maxLength={10}
                                    autoFocus
                                    className="pl-10 bg-[#1e293b] border-[#334155] text-white text-center text-2xl tracking-widest placeholder:text-slate-600 focus:border-[#00ff88] focus:ring-[#00ff88]/20"
                                />
                            </div>
                            <p className="text-xs text-slate-500 text-center">
                                También puedes usar un código de respaldo
                            </p>
                        </div>

                        <div className="space-y-3">
                            <Button
                                type="submit"
                                disabled={loading || code.length < 6}
                                className="w-full bg-[#00ff88] text-[#020617] hover:bg-[#00cc6a] font-bold tracking-wide"
                            >
                                {loading ? 'Verificando...' : 'VERIFICAR'}
                            </Button>
                            
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={goBack}
                                disabled={loading}
                                className="w-full text-slate-400 hover:text-white"
                            >
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                Volver
                            </Button>
                        </div>
                    </form>

                    <div className="text-center pt-4">
                        <p className="text-xs text-slate-600 font-mono">
                            2FA SECURE // TOTP PROTOCOL
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Render Credentials Step
    return (
        <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8 bg-[#0f172a] p-8 rounded-xl border border-[#1e293b] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#00ff88] to-transparent opacity-50"></div>

                <div className="flex flex-col items-center">
                    <div className="h-16 w-16 bg-[#00ff88]/10 rounded-2xl flex items-center justify-center mb-4 border border-[#00ff88]/20 animate-pulse">
                        <MapPin className="h-8 w-8 text-[#00ff88]" />
                    </div>
                    <h2 className="text-2xl font-bold text-white tracking-tight">Console Access</h2>
                    <p className="text-slate-400 text-sm mt-2">Restricted Area. Authorized Personnel Only.</p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleCredentials}>
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
                        disabled={loading || !email || !password}
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
