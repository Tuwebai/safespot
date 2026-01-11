
import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { API_BASE_URL } from '../lib/api';

export default function ResetPassword() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Enlace inválido o expirado. Por favor solicitá uno nuevo.');
        }
    }, [token]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            setStatus('error');
            setMessage('Las contraseñas no coinciden.');
            return;
        }

        if (password.length < 6) {
            setStatus('error');
            setMessage('La contraseña debe tener al menos 6 caracteres.');
            return;
        }

        setStatus('loading');
        setMessage('');

        try {
            const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, email, newPassword: password })
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || 'Error al restablecer contraseña');
            }

            setStatus('success');
            setMessage('¡Contraseña restablecida correctamente!');

            // Redirect to home after 3 seconds
            setTimeout(() => {
                navigate('/');
            }, 3000);

        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'Ocurrió un error inesperado.');
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4">
                <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-xl max-w-md w-full text-center border border-gray-200 dark:border-gray-800">
                    <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
                        <AlertCircle size={32} />
                    </div>
                    <h2 className="text-2xl font-bold mb-2 text-gray-900 dark:text-white">Enlace inválido</h2>
                    <p className="text-gray-600 dark:text-gray-400 mb-6">Error: Falta el token de seguridad.</p>
                    <button onClick={() => navigate('/')} className="text-indigo-600 font-semibold hover:underline">
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black p-4 font-sans">
            <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-gray-800 animate-in fade-in zoom-in-95 duration-300">

                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-600 dark:text-indigo-400">
                        <Lock size={32} />
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nueva Contraseña</h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-2 text-sm">
                        {email ? `Para: ${email}` : 'Ingresá tu nueva clave segura'}
                    </p>
                </div>

                {status === 'success' ? (
                    <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-300">
                        <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-xl mb-6 flex flex-col items-center gap-2">
                            <CheckCircle size={32} />
                            <p className="font-medium">{message}</p>
                        </div>
                        <p className="text-sm text-gray-500 mb-6">Redirigiendo al inicio...</p>
                        <button
                            onClick={() => navigate('/')}
                            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold shadow-lg hover:shadow-indigo-500/25 transition-all"
                        >
                            Ir al Inicio ahora
                        </button>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {status === 'error' && (
                            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2 animate-in shake">
                                <AlertCircle size={16} />
                                {message}
                            </div>
                        )}

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nueva Contraseña</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Contraseña</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={status === 'loading'}
                            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {status === 'loading' ? <Loader2 className="animate-spin" /> : 'Restablecer Clave'}
                            {status !== 'loading' && <ArrowRight size={18} />}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
}
