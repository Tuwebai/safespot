
import React, { useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Mail, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../../lib/api';
import { getAnonymousId } from '../../lib/identity';
import { useGoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';
import { isGoogleAvatar, migrateGoogleAvatar } from '../../lib/avatar';

export type AuthMode = 'login' | 'register' | 'forgot-password';

interface AuthFormProps {
    initialMode?: AuthMode;
    onSuccess?: () => void;
    className?: string;
    showHeader?: boolean; // Control if the component renders its own header
    showHeaderImage?: boolean; // Control if the gradient header is shown
}

export function AuthForm({
    initialMode = 'login',
    onSuccess,
    className = '',
    showHeader = true,
    showHeaderImage = false
}: AuthFormProps) {
    const navigate = useNavigate();
    const [mode, setMode] = useState<AuthMode>(initialMode);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const { loginSuccess } = useAuthStore();

    const handleGoogleLogin = useGoogleLogin({
        onSuccess: async (response) => {
            setIsLoading(true);
            try {
                // Call our backend
                const backendRes = await fetch(`${API_BASE_URL}/auth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        google_access_token: response.access_token,
                        current_anonymous_id: getAnonymousId()
                    })
                });

                const data = await backendRes.json();
                if (!backendRes.ok) throw new Error(data.error || 'Error con Google');

                // Success
                localStorage.setItem('safespot_auth_swapped', 'true');
                setSuccess('Sesión iniciada con Google.');
                setTimeout(() => performLogin(data), 800);
            } catch (err: any) {
                setError('No se pudo iniciar sesión con Google.');
                setIsLoading(false);
            }
        },
        onError: () => {
            setError('Ventana cerrada o error de conexión.');
            setIsLoading(false);
        }
    });

    // Helper to map technical errors to human-friendly messages
    const getHumanError = (msg: string) => {
        const lower = msg.toLowerCase();
        if (lower.includes('invalid credentials') || lower.includes('password')) return 'Email o contraseña incorrectos.';
        if (lower.includes('already exists') || lower.includes('duplicate')) return 'Este email ya está registrado.';
        if (lower.includes('incomplete') || lower.includes('required')) return 'Por favor, completá todos los campos.';
        return 'Ocurrió un error. Verificá tus datos e intentá nuevamente.';
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        try {
            let endpoint = '';
            let payload: any = {};

            if (mode === 'login') {
                endpoint = '/auth/login';
                payload = { email, password };
            } else if (mode === 'register') {
                endpoint = '/auth/register';
                payload = { email, password, current_anonymous_id: getAnonymousId() };
            } else if (mode === 'forgot-password') {
                endpoint = '/auth/forgot-password';
                payload = { email };
            }

            const res = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Ocurrió un error inesperado');
            }

            // SUCCESS HANDLERS
            if (mode === 'forgot-password') {
                setSuccess('Si el correo existe, recibirás un enlace de recuperación en breve.');
                setIsLoading(false);
            } else {
                // Identity Swap Success -> Set flag for Toast after reload
                localStorage.setItem('safespot_auth_swapped', 'true');

                if (mode === 'register') {
                    setSuccess('Cuenta creada. Ingresando...');
                } else {
                    setSuccess('Sesión iniciada. Ingresando...');
                }

                // Small delay to let user see "Ingresando..."
                setTimeout(async () => {
                    try {
                        await performLogin(data);
                    } catch (err: any) {
                        setError(getHumanError(err?.message || 'Ocurrió un error al iniciar sesión.'));
                        setIsLoading(false);
                    }
                }, 800);
            }

        } catch (err: any) {
            setError(getHumanError(err.message));
            setIsLoading(false);
        }
    }

    async function performLogin(data: any) {
        // Normalización de contrato:
        // login email/password no siempre retorna user.id, pero sí anonymous_id.
        const resolvedAuthId = data.user?.id || data.user?.auth_id || data.anonymous_id;
        if (!resolvedAuthId || !data.anonymous_id || !data.token) {
            throw new Error('Invalid server response: missing authentication identity.');
        }

        let avatarUrl = data.user?.avatar_url ?? null;
        
        // 🏛️ MIGRATE: If Google avatar, download and upload to Supabase bucket
        // This prevents Tracking Prevention blocking the image
        if (avatarUrl && isGoogleAvatar(avatarUrl)) {
            console.log('[Auth] Detected Google avatar, migrating to Supabase...');
            const migratedUrl = await migrateGoogleAvatar(avatarUrl, data.anonymous_id, data.token);
            if (migratedUrl) {
                avatarUrl = migratedUrl;
            }
        }

        const user = {
            email: data.user?.email || email,
            auth_id: resolvedAuthId,
            anonymous_id: data.anonymous_id,
            provider: data.user?.provider || (mode === 'register' || mode === 'login' ? 'email' : undefined),
            alias: data.user?.alias ?? null,           // ✅ FIX: Propagar alias del backend
            avatar_url: avatarUrl  // ✅ FIX: Usar avatar migrado si aplica
        };
        // ✅ FIX: Pass backend signature for Identity Shield (HMAC-SHA256)
        await loginSuccess(data.token, data.anonymous_id, user, data.signature);
        if (onSuccess) {
            onSuccess();
        } else {
            // Default behavior if not in a modal: redirect to profile/home
            navigate('/perfil');
        }
    }

    const getTitle = () => {
        if (mode === 'login') return 'Bienvenido de vuelta';
        if (mode === 'register') return 'Crear Cuenta';
        return 'Recuperar Contraseña';
    }

    const getSubtitle = () => {
        if (mode === 'login') return 'Ingresá para acceder a tu historial.';
        if (mode === 'register') return 'Guardá tu progreso y medallas.';
        return 'Te enviaremos un enlace para restablecerla.';
    }

    return (
        <div className={`w-full ${className}`}>

            {showHeaderImage && (
                <div className="relative p-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-t-2xl">
                    <h2 className="text-2xl font-bold">{getTitle()}</h2>
                    <p className="text-indigo-100 mt-2 text-sm">{getSubtitle()}</p>
                </div>
            )}

            {!showHeaderImage && showHeader && (
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-foreground">{getTitle()}</h2>
                    <p className="text-muted-foreground mt-2 text-sm">{getSubtitle()}</p>
                </div>
            )}

            <div className={showHeaderImage ? "p-6" : ""}>
                {error && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm animate-in shake">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
                        <CheckCircle size={16} />
                        {success}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Google Button */}
                    <button
                        type="button"
                        onClick={() => handleLogoutGoogle()}
                        disabled={isLoading}
                        className="w-full py-2.5 px-4 bg-white dark:bg-white text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-50 transition-all flex justify-center items-center gap-2 mb-2 shadow-sm"
                    >
                        <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
                        Continuar con Google
                    </button>

                    <div className="relative flex items-center justify-center my-4">
                        <hr className="w-full border-gray-200 dark:border-gray-700 absolute" />
                        <span className="bg-white dark:bg-gray-900 px-2 text-xs text-gray-400 font-medium relative z-10 uppercase">O con email</span>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
                        <div className="relative">
                            <input
                                type="email"
                                required
                                autoFocus
                                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                placeholder="tu@email.com"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                disabled={isLoading}
                            />
                            <Mail className="absolute left-3 top-3 text-gray-400" size={18} />
                        </div>
                    </div>

                    {mode !== 'forgot-password' && (
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña</label>
                            <div className="relative">
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    disabled={isLoading}
                                />
                                <Lock className="absolute left-3 top-3 text-gray-400" size={18} />
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4"
                    >
                        {isLoading && <Loader2 size={18} className="animate-spin" />}
                        {isLoading ? (mode === 'register' ? 'Creando cuenta...' : 'Ingresando...') : (mode === 'login' ? 'Ingresar' : mode === 'register' ? 'Crear Cuenta' : 'Enviar Enlace')}
                    </button>
                </form>

                <div className="mt-4 text-center">
                    {mode === 'login' && (
                        <button
                            type="button"
                            onClick={() => {
                                setMode('forgot-password');
                                setError(null);
                                setSuccess(null);
                            }}
                            className="text-xs text-muted-foreground hover:text-indigo-500 mb-4 block w-full"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    )}
                </div>

                {mode !== 'forgot-password' && (
                    <div className="text-center text-sm border-t border-gray-100 dark:border-gray-800 pt-4">
                        <span className="text-gray-500">
                            {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}
                        </span>
                        <button
                            onClick={() => {
                                setMode(mode === 'login' ? 'register' : 'login');
                                setError(null);
                                setSuccess(null);
                            }}
                            className="ml-2 text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                        >
                            {mode === 'login' ? 'Registrate' : 'Iniciá sesión'}
                        </button>
                    </div>
                )}

                {mode === 'forgot-password' && (
                    <div className="text-center text-sm border-t border-gray-100 dark:border-gray-800 pt-4">
                        <button
                            onClick={() => {
                                setMode('login');
                                setError(null);
                                setSuccess(null);
                            }}
                            className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                        >
                            Volver al inicio de sesión
                        </button>
                    </div>
                )}
            </div>
        </div>
    );

    function handleLogoutGoogle() {
        // Wrapper because usage inside JSX event handler
        handleGoogleLogin();
    }
}
