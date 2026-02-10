/**
 * 🏛️ SAFE MODE: DataSection - Configuración de Datos
 * 
 * Fase 2 del refactor enterprise: Sección de datos extraída.
 * 
 * @version 1.0 - Extracción desde SettingsPage
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Database, 
    RefreshCw, 
    Activity,
    Info
} from 'lucide-react';
import { useConfirm } from '@/components/ui/useConfirm';
import { useQueryClient } from '@tanstack/react-query';
import { RealtimeStatusIndicator } from '@/components/RealtimeStatusIndicator';
import { getAnonymousIdSafe } from '@/lib/identity';

export function DataSection() {
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const anonymousId = getAnonymousIdSafe();

    const handleClearCache = () => {
        queryClient.clear();
        window.location.reload();
    };

    const handleResetApp = async () => {
        const confirmed = await confirm({
            title: '¿Borrar datos locales?',
            description: 'Se borrarán todos tus ajustes locales y caché. Deberás iniciar sesión nuevamente.',
            confirmText: 'Borrar todo',
            variant: 'danger'
        });

        if (confirmed) {
            localStorage.clear();
            window.location.reload();
        }
    };

    return (
        <div className="space-y-6">
            {/* Storage Management */}
            <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Database className="w-5 h-5 text-blue-400" />
                        Almacenamiento Local
                    </CardTitle>
                    <CardDescription>
                        Gestiona los datos guardados en tu navegador.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Clear Cache */}
                    <div className="flex items-center justify-between border-b border-white/5 pb-6">
                        <div className="space-y-0.5">
                            <h4 className="font-medium">Limpiar Cache de Datos</h4>
                            <p className="text-sm text-muted-foreground">
                                Recarga toda la información desde el servidor.
                            </p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearCache}
                            className="gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Limpiar
                        </Button>
                    </div>

                    {/* Reset App */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <h4 className="font-medium text-red-400">Restablecer Aplicación</h4>
                            <p className="text-sm text-muted-foreground">
                                Borra todos tus ajustes y preferencias locales.
                            </p>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleResetApp}
                            className="gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Restablecer
                        </Button>
                    </div>

                    {/* System Health */}
                    <div className="border-t border-white/5 pt-6 space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <Activity className="w-4 h-4 text-neon-green" />
                            Salud del Sistema
                        </h4>
                        <Card className="bg-black/40 border-white/5 shadow-inner">
                            <CardContent className="pt-6">
                                <RealtimeStatusIndicator />
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>

            {/* About */}
            <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Info className="w-5 h-5 text-neon-green" />
                        Acerca de SafeSpot
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Versión</span>
                        <span className="font-mono">{import.meta.env.PACKAGE_VERSION}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Estado del Servidor</span>
                        <span className="text-neon-green">En línea (Redis Optimized)</span>
                    </div>
                    <div className="flex justify-between border-t border-white/5 pt-4 mt-4">
                        <span className="text-muted-foreground">ID de Sesión</span>
                        <span className="font-mono text-[10px] opacity-50">
                            {anonymousId.substring(0, 12)}...
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
