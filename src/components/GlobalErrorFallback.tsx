import { AlertTriangle, RefreshCcw, Trash2 } from 'lucide-react';

interface GlobalErrorFallbackProps {
    error?: Error;
    resetErrorBoundary?: () => void;
    title?: string;
    message?: string;
}

/**
 * Enterprise Grade Error Screen
 * 
 * Used for:
 * 1. Global Error Boundary catches
 * 2. Startup Watchdog Timeouts
 * 3. Fatal Identity Failures
 */
export function GlobalErrorFallback({ 
    error, 
    resetErrorBoundary,
    title = "Algo salió mal",
    message = "No pudimos cargar SafeSpot correctamente."
}: GlobalErrorFallbackProps) {
    
    // Función de emergencia para limpiar todo si la app está en loop
    const handleHardReset = () => {
        if (confirm('¿Estás seguro? Esto borrará tus datos temporales y recargará la aplicación. Tus reportes guardados en el servidor están seguros.')) {
            localStorage.clear();
            sessionStorage.clear();
            
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(registrations => {
                    for (const registration of registrations) {
                        registration.unregister();
                    }
                });
            }
            
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }

            window.location.reload();
        }
    };

    return (
        <div className="min-h-screen bg-studio-950 flex items-center justify-center p-4 font-sans text-studio-50">
            <div className="max-w-md w-full bg-studio-900/50 border border-red-500/20 rounded-2xl p-8 backdrop-blur-xl shadow-2xl animate-fade-in relative overflow-hidden">
                
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/10 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2" />
                
                <div className="flex flex-col items-center text-center space-y-6">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center ring-1 ring-red-500/30">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>

                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-studio-400 bg-clip-text text-transparent">
                            {title}
                        </h1>
                        <p className="text-studio-400 text-sm leading-relaxed">
                            {message}
                        </p>
                        {error && (
                            <div className="mt-4 p-3 bg-red-950/30 border border-red-900/50 rounded-lg text-xs font-mono text-red-300 break-all text-left">
                                {error.message || 'Unknown Error'}
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 w-full gap-3 pt-4">
                        <button
                            onClick={resetErrorBoundary || (() => window.location.reload())}
                            className="flex items-center justify-center w-full px-4 py-3 bg-studio-50 text-studio-950 rounded-xl font-semibold hover:bg-white transition-all active:scale-95 text-sm"
                        >
                            <RefreshCcw className="w-4 h-4 mr-2" />
                            Intentar de nuevo
                        </button>
                        
                        <button
                            onClick={handleHardReset}
                            className="flex items-center justify-center w-full px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-medium hover:bg-red-500/20 transition-all active:scale-95 text-sm"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Restablecer App (Reset)
                        </button>
                    </div>

                    <p className="text-[10px] text-studio-600">
                        Si el problema persiste, contacta a soporte.
                        <br />
                        Code: {error?.name || 'CRITICAL_FAILURE'}
                    </p>
                </div>
            </div>
        </div>
    );
}
