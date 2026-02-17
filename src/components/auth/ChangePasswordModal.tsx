import { createPortal } from 'react-dom';
import React, { useState } from 'react';
import { X, Lock, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { getOverlayZIndex } from '@/config/z-index';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useKeyPress } from '@/hooks/useKeyPress';
import { useAuthApi } from '@/hooks/useAuthApi';

interface ChangePasswordModalProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * 🏛️ ChangePasswordModal - Modal para cambiar contraseña
 * 
 * Enterprise features:
 * - ✅ React Portal (document.body)
 * - ✅ Sistema z-index integrado (capa MODAL)
 * - ✅ Bloqueo de scroll automático
 * - ✅ Cierre con tecla Escape
 */
export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const authApi = useAuthApi();

    // 🏛️ ENTERPRISE: Bloquear scroll cuando está abierto
    useScrollLock(isOpen);
    
    // 🏛️ ENTERPRISE: Cerrar con Escape
    useKeyPress('Escape', onClose, isOpen);

    if (!isOpen) return null;

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        setSuccess(null);

        if (newPassword !== confirmPassword) {
            setError('Las contraseñas nuevas no coinciden');
            setIsLoading(false);
            return;
        }

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            setIsLoading(false);
            return;
        }

        try {
            await authApi.changePassword(currentPassword, newPassword);

            setSuccess('Contraseña actualizada con éxito');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            // Optional: Force logout for security
            // logout(); 
            // User requested "Cambiar Contraseña" flow, usually we keep session active unless requested otherwise.

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }

    // Obtener z-index del sistema
    const zIndexes = getOverlayZIndex('modal');

    return createPortal(
        <>
            {/* Backdrop */}
            <div 
                className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
                style={{ zIndex: zIndexes.backdrop }}
                onClick={onClose}
                aria-hidden="true"
            />
            
            {/* Content Container */}
            <div 
                className="fixed inset-0 flex items-end sm:items-center justify-center sm:p-4 pointer-events-none"
                style={{ zIndex: zIndexes.content }}
                role="dialog"
                aria-modal="true"
            >
                <div 
                    className="bg-white dark:bg-gray-900 w-full max-w-md rounded-t-2xl rounded-b-none sm:rounded-2xl shadow-2xl border-t border-x sm:border border-gray-200 dark:border-gray-800 overflow-hidden animate-in slide-in-from-bottom sm:zoom-in-95 duration-200 relative pointer-events-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="relative p-6 bg-gradient-to-br from-indigo-600 to-purple-600 text-white">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-1 rounded-full hover:bg-white/20 transition-colors"
                            aria-label="Cerrar"
                        >
                            <X size={20} />
                        </button>

                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <Lock size={20} />
                            Cambiar Contraseña
                        </h2>
                    </div>

                    {/* Form */}
                    <div className="p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
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
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contraseña Actual</label>
                                <input
                                    type="password"
                                    required
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    value={currentPassword}
                                    onChange={e => setCurrentPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nueva Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirmar Nueva Contraseña</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4"
                            >
                                {isLoading && <Loader2 size={18} className="animate-spin" />}
                                Actualizar Contraseña
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}
