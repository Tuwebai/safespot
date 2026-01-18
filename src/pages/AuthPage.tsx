
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthForm, AuthMode } from '@/components/auth/AuthForm';
import { ArrowLeft, MapPin } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';

export default function AuthPage() {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuthStore();

    // Determine mode from URL path or query param
    // We will register this component for both /login and /register routes
    const isRegister = window.location.pathname.includes('register');
    const initialMode: AuthMode = isRegister ? 'register' : 'login';

    // Redirect if already authenticated
    useEffect(() => {
        if (isAuthenticated) {
            navigate('/register');
        }
    }, [isAuthenticated, navigate]);

    return (
        <div className="min-h-screen bg-zinc-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">

            {/* Background Ambience */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
                <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-md relative z-10">
                <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-700">
                    <Link to="/" className="inline-flex items-center text-zinc-400 hover:text-white mb-6 transition-colors">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al inicio
                    </Link>

                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-r from-neon-green to-green-400 flex items-center justify-center shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                            <MapPin className="w-7 h-7 text-zinc-950" />
                        </div>
                    </div>

                    <h1 className="text-3xl font-black tracking-tighter text-white mb-2">
                        SafeSpot
                    </h1>
                    <p className="text-zinc-400">
                        {isRegister ? 'Únete a la comunidad de seguridad colaborativa.' : 'Bienvenido de nuevo.'}
                    </p>
                </div>

                <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-in zoom-in-95 duration-300">
                    <AuthForm
                        initialMode={initialMode}
                        showHeader={true}
                        showHeaderImage={false}
                        className="bg-transparent"
                    />
                </div>

                <p className="text-center text-zinc-500 text-xs mt-8">
                    Al continuar, aceptas nuestros <Link to="/terminos" className="underline hover:text-zinc-300">Términos de Servicio</Link> y <Link to="/privacidad" className="underline hover:text-zinc-300">Política de Privacidad</Link>.
                </p>
            </div>
        </div>
    );
}
