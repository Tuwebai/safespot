/**
 * 🏛️ SAFE MODE: PrivacySection - Configuración de Privacidad
 * 
 * Fase 2 del refactor enterprise: Sección de privacidad extraída.
 * 
 * @version 1.0 - Extracción desde SettingsPage
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { 
    Shield, 
    RefreshCw, 
    UserX, 
    Ghost, 
    Database, 
    Download, 
    Upload,
    AlertTriangle
} from 'lucide-react';
import { useConfirm } from '@/components/ui/useConfirm';
import { useToast } from '@/components/ui/toast';
import { useQueryClient } from '@tanstack/react-query';
import { getAnonymousIdSafe, exportIdentity, importIdentity } from '@/lib/identity';
import { getAvatarUrl } from '@/lib/avatar';
import { useUpdateProfileMutation } from '@/hooks/mutations/useUpdateProfileMutation';
import { handleError } from '@/lib/errorHandler';

export function PrivacySection() {
    const toast = useToast();
    const { confirm } = useConfirm();
    const queryClient = useQueryClient();
    const updateProfile = useUpdateProfileMutation();
    const anonymousId = getAnonymousIdSafe();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [hideAvatar, setHideAvatar] = useState(false);
    const [ghostMode, setGhostMode] = useState(false);
    const [isImporting, setIsImporting] = useState(false);

    // Load from localStorage
    useEffect(() => {
        setHideAvatar(localStorage.getItem('safespot_hide_avatar') === 'true');
        setGhostMode(localStorage.getItem('safespot_ghost_mode') === 'true');
    }, []);

    const persist = (key: string, val: string | boolean) => {
        localStorage.setItem(key, String(val));
    };

    const handleRegenerateIdentity = async () => {
        try {
            const randomSeed = Math.random().toString(36).substring(7);
            const newAvatarUrl = getAvatarUrl(`${anonymousId}-${randomSeed}`);
            await updateProfile.mutateAsync({ avatar_url: newAvatarUrl });
            toast.success("Identidad visual regenerada");
        } catch (err) {
            // Error handled by mutation
        }
    };

    const handleExportIdentity = () => {
        exportIdentity();
        toast.success("Factura de identidad descargada");
    };

    const handleImportIdentity = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const confirmed = await confirm({
            title: '¿Restablecer identidad?',
            description: 'Tu identidad actual será reemplazada y la aplicación se reiniciará. Esta acción no se puede deshacer.',
            confirmText: 'Restablecer',
            variant: 'danger'
        });

        if (!confirmed) {
            if (fileInputRef.current) fileInputRef.current.value = '';
            return;
        }

        setIsImporting(true);
        try {
            await importIdentity(file);
            toast.success("Identidad restaurada con éxito");
            setTimeout(() => {
                queryClient.clear();
                window.location.reload();
            }, 1500);
        } catch (err: unknown) {
            handleError(err, toast.error, 'Settings.importIdentity');
            if (fileInputRef.current) fileInputRef.current.value = '';
        } finally {
            setIsImporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card className="bg-dark-card border-primary/20 border">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="w-5 h-5 text-primary" />
                        Identidad Anónima
                    </CardTitle>
                    <CardDescription>
                        Acciones críticas para proteger tu rastro en la red.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Regenerate Identity */}
                    <div className="flex items-center justify-between bg-black/40 p-4 rounded-lg border border-white/5">
                        <div className="space-y-1">
                            <h4 className="font-bold text-sm">Regenerar Identidad</h4>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                                Cambia tu avatar aleatorio por uno nuevo. Esto desvincula tu apariencia visual previa.
                            </p>
                        </div>
                        <Button 
                            onClick={handleRegenerateIdentity} 
                            variant="outline" 
                            size="sm" 
                            className="gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> Regenerar
                        </Button>
                    </div>

                    {/* Hide Avatar */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium flex items-center gap-2">
                                <UserX className="w-4 h-4" /> Ocultar Avatar Público
                            </label>
                            <p className="text-sm text-muted-foreground">
                                Muestra un avatar genérico a otros usuarios.
                            </p>
                        </div>
                        <Switch 
                            checked={hideAvatar} 
                            onCheckedChange={(v) => { 
                                setHideAvatar(v); 
                                persist('safespot_hide_avatar', v); 
                            }} 
                        />
                    </div>

                    {/* Ghost Mode */}
                    <div className="border-t border-white/5 pt-6 flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium flex items-center gap-2">
                                <Ghost className="w-4 h-4" /> Modo Fantasma
                            </label>
                            <p className="text-sm text-muted-foreground">
                                Navega sin aparecer online (No sumas puntos de presencia).
                            </p>
                        </div>
                        <Switch 
                            checked={ghostMode} 
                            onCheckedChange={(v) => { 
                                setGhostMode(v); 
                                persist('safespot_ghost_mode', v); 
                            }} 
                        />
                    </div>

                    {/* Backup/Restore */}
                    <div className="border-t border-white/5 pt-6 space-y-4">
                        <h4 className="font-bold text-sm flex items-center gap-2">
                            <Database className="w-4 h-4 text-blue-400" />
                            Respaldo Extremo
                        </h4>
                        <p className="text-xs text-muted-foreground">
                            SafeSpot no usa correos. Si pierdes este navegador, pierdes tu reputación.
                            Descarga tu identidad para restaurarla en otro dispositivo.
                        </p>

                        <div className="grid grid-cols-2 gap-4">
                            <Button
                                onClick={handleExportIdentity}
                                variant="outline"
                                className="gap-2 border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
                            >
                                <Download className="w-4 h-4" /> Exportar
                            </Button>

                            <Button
                                onClick={() => fileInputRef.current?.click()}
                                variant="outline"
                                disabled={isImporting}
                                className="gap-2 border-orange-500/30 hover:bg-orange-500/10 text-orange-400"
                            >
                                <Upload className="w-4 h-4" /> 
                                {isImporting ? 'Importando...' : 'Restaurar'}
                            </Button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleImportIdentity}
                                accept=".json"
                                className="hidden"
                            />
                        </div>

                        <div className="p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex gap-3 text-orange-200/80">
                            <AlertTriangle className="w-5 h-5 shrink-0" />
                            <p className="text-[10px] leading-tight">
                                <strong>IMPORTANTE:</strong> Cualquiera con tu archivo de identidad puede suplantarte.
                                Mantenlo en un lugar seguro y no lo compartas.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
