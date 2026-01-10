import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
    ArrowLeft, Bell, Palette, Monitor, Map as MapIcon,
    Eye, Shield, RefreshCw, Ghost, UserX, MapPin,
    Database, Trash2, Info
} from 'lucide-react';
import { NotificationSettingsSection } from '@/components/NotificationSettingsSection';
import { AlertZoneStatusSection } from '@/components/AlertZoneStatusSection';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { getAnonymousIdSafe } from '@/lib/identity';
import { getAvatarUrl } from '@/lib/avatar';
import { usersApi } from '@/lib/api';
import { handleError } from '@/lib/errorHandler';
import { useToast } from '@/components/ui/toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';

export function SettingsPage() {
    const navigate = useNavigate();
    const toast = useToast();
    const queryClient = useQueryClient();
    const { theme, setTheme, openCustomizer, savePreferences } = useTheme();
    const anonymousId = getAnonymousIdSafe();

    // --- SHARED STATE ---
    const [activeTab, setActiveTab] = useState("notifications");

    // --- PHASE 1 STATE (Appearance) ---
    const [reducedMotion, setReducedMotion] = useState(false);
    const [mapDensity, setMapDensity] = useState(false);

    // --- PHASE 2 STATE (Map) ---
    const [mapStyle, setMapStyle] = useState('streets');
    const [autoCenter, setAutoCenter] = useState(true);

    // --- PHASE 3 STATE (Privacy) ---
    const [hideAvatar, setHideAvatar] = useState(false);
    const [ghostMode, setGhostMode] = useState(false);

    // Load Profile for Privacy (Avatar)
    const { refetch: refetchProfile } = useQuery({
        queryKey: ['profile'],
        queryFn: () => usersApi.getProfile()
    });

    useEffect(() => {
        // Load from localStorage
        setReducedMotion(localStorage.getItem('safespot_reduced_motion') === 'true');
        setMapDensity(localStorage.getItem('safespot_map_density') === 'true');

        setMapStyle(localStorage.getItem('safespot_map_style') || 'streets');
        setAutoCenter(localStorage.getItem('safespot_auto_center') !== 'false');

        setHideAvatar(localStorage.getItem('safespot_hide_avatar') === 'true');
        setGhostMode(localStorage.getItem('safespot_ghost_mode') === 'true');
    }, []);

    // --- PERSISTENCE HANDLERS ---
    const persist = (key: string, val: any) => {
        localStorage.setItem(key, String(val));
    };

    const toggleReducedMotion = (val: boolean) => {
        setReducedMotion(val);
        persist('safespot_reduced_motion', val);
        if (val) document.documentElement.classList.add('reduce-motion');
        else document.documentElement.classList.remove('reduce-motion');
    };

    const handleRegenerateIdentity = async () => {
        try {
            const randomSeed = Math.random().toString(36).substring(7);
            const newAvatarUrl = getAvatarUrl(`${anonymousId}-${randomSeed}`);

            await usersApi.updateProfile({ avatar_url: newAvatarUrl });
            await refetchProfile();
            toast.success("Identidad visual regenerada");
        } catch (err) {
            handleError(err, toast.error, 'Settings.regenerateIdentity');
        }
    };

    return (
        <div className="container mx-auto max-w-3xl px-4 py-8">
            <div className="flex items-center gap-4 mb-8">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/perfil')}
                    className="rounded-full hover:bg-white/10"
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-2xl font-bold">Configuración</h1>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="flex w-full mb-8 bg-dark-card border border-white/5 overflow-x-auto h-auto p-1 no-scrollbar">
                    <TabsTrigger value="notifications" className="flex-1 py-2 data-[state=active]:bg-neon-green/10 data-[state=active]:text-neon-green">
                        <Bell className="w-4 h-4 mr-2 hidden sm:inline" />
                        Alertas
                    </TabsTrigger>
                    <TabsTrigger value="appearance" className="flex-1 py-2 data-[state=active]:bg-neon-green/10 data-[state=active]:text-neon-green">
                        <Palette className="w-4 h-4 mr-2 hidden sm:inline" />
                        Apariencia
                    </TabsTrigger>
                    <TabsTrigger value="map" className="flex-1 py-2 data-[state=active]:bg-neon-green/10 data-[state=active]:text-neon-green">
                        <MapIcon className="w-4 h-4 mr-2 hidden sm:inline" />
                        Mapa
                    </TabsTrigger>
                    <TabsTrigger value="privacy" className="flex-1 py-2 data-[state=active]:bg-neon-green/10 data-[state=active]:text-neon-green">
                        <Shield className="w-4 h-4 mr-2 hidden sm:inline" />
                        Privacidad
                    </TabsTrigger>
                    <TabsTrigger value="data" className="flex-1 py-2 data-[state=active]:bg-neon-green/10 data-[state=active]:text-neon-green">
                        <Database className="w-4 h-4 mr-2 hidden sm:inline" />
                        Datos
                    </TabsTrigger>
                </TabsList>

                {/* --- NOTIFICATIONS TAB --- */}
                <TabsContent value="notifications" className="space-y-8 animate-in fade-in slide-in-from-left-4 duration-300">
                    <AlertZoneStatusSection />
                    <NotificationSettingsSection />
                </TabsContent>

                {/* --- APPEARANCE TAB --- */}
                <TabsContent value="appearance" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    {/* Quick Theme Selector */}
                    <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Palette className="w-5 h-5 text-neon-green" />
                                Tema Visual
                            </CardTitle>
                            <CardDescription>
                                Personaliza el esquema de colores de la aplicación
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                    { id: 'default', name: 'Original', color: 'bg-black border-neon-green' },
                                    { id: 'neon', name: 'Neon', color: 'bg-slate-900 border-purple-500' },
                                    { id: 'pastel', name: 'Pastel', color: 'bg-indigo-950 border-pink-400' },
                                    { id: 'minimal', name: 'Minimal', color: 'bg-neutral-900 border-gray-400' }
                                ].map((t) => (
                                    <button
                                        key={t.id}
                                        onClick={() => { setTheme(t.id as any); savePreferences(); }}
                                        className={cn(
                                            "relative p-4 rounded-xl border-2 transition-all hover:scale-105",
                                            t.color,
                                            theme === t.id ? "ring-2 ring-neon-green ring-offset-2 ring-offset-black" : "border-white/10 opacity-60 hover:opacity-100"
                                        )}
                                    >
                                        <div className="text-center font-bold text-sm text-white">{t.name}</div>
                                    </button>
                                ))}
                            </div>

                            <div className="mt-6">
                                <Button onClick={openCustomizer} variant="outline" className="w-full">
                                    Abrir Personalizador Avanzado
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Accessibility & Interface */}
                    <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Monitor className="w-5 h-5 text-blue-500" />
                                Interfaz
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">

                            {/* Reduced Motion */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-base font-medium text-foreground flex items-center gap-2">
                                        <Eye className="w-4 h-4" />
                                        Reducción de Movimiento
                                    </label>
                                    <p className="text-sm text-muted-foreground">
                                        Desactiva animaciones complejas en el mapa y transiciones.
                                    </p>
                                </div>
                                <Switch
                                    checked={reducedMotion}
                                    onCheckedChange={toggleReducedMotion}
                                />
                            </div>

                            <div className="border-t border-white/5" />

                            {/* Map Density */}
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-base font-medium text-foreground flex items-center gap-2">
                                        <MapIcon className="w-4 h-4" />
                                        Limpieza de Mapa
                                    </label>
                                    <p className="text-sm text-muted-foreground">
                                        Ocultar reportes antiguos automáticamente para mejorar la visibilidad.
                                    </p>
                                </div>
                                <Switch
                                    checked={mapDensity}
                                    onCheckedChange={(v) => { setMapDensity(v); persist('safespot_map_density', v); }}
                                />
                            </div>

                        </CardContent>
                    </Card>

                </TabsContent>

                {/* --- MAP TAB (PHASE 2) --- */}
                <TabsContent value="map" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <MapIcon className="w-5 h-5 text-orange-500" />
                                Capas del Mapa
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-3 gap-4">
                                {[
                                    { id: 'streets', name: 'Calles', icon: <MapIcon /> },
                                    { id: 'satellite', name: 'Satélite', icon: <div className="w-4 h-4 rounded-full bg-blue-900" /> },
                                    { id: 'hybrid', name: 'Híbrido', icon: <div className="w-4 h-4 rounded-full bg-slate-700" /> }
                                ].map((s) => (
                                    <button
                                        key={s.id}
                                        onClick={() => { setMapStyle(s.id); persist('safespot_map_style', s.id); }}
                                        className={cn(
                                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                                            mapStyle === s.id ? "bg-neon-green/10 border-neon-green text-neon-green" : "bg-white/5 border-white/10 text-muted-foreground opacity-60 hover:opacity-100"
                                        )}
                                    >
                                        <span className="text-xs font-bold uppercase tracking-wider">{s.name}</span>
                                    </button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                            <CardTitle className="text-lg">Comportamiento</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-base font-medium flex items-center gap-2">
                                        <MapPin className="w-4 h-4" /> Auto-centrar Mapa
                                    </label>
                                    <p className="text-sm text-muted-foreground">Centra el mapa en tu ubicación al iniciar.</p>
                                </div>
                                <Switch checked={autoCenter} onCheckedChange={(v) => { setAutoCenter(v); persist('safespot_auto_center', v); }} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- PRIVACY TAB (PHASE 3) --- */}
                <TabsContent value="privacy" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <Card className="bg-dark-card border-primary/20 border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Shield className="w-5 h-5 text-primary" />
                                Identidad Anónima
                            </CardTitle>
                            <CardDescription>Acciones críticas para proteger tu rastro en la red.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between bg-black/40 p-4 rounded-lg border border-white/5">
                                <div className="space-y-1">
                                    <h4 className="font-bold text-sm">Regenerar Identidad</h4>
                                    <p className="text-xs text-muted-foreground max-w-[200px]">Cambia tu avatar aleatorio por uno nuevo. Esto desvincula tu apariencia visual previa.</p>
                                </div>
                                <Button onClick={handleRegenerateIdentity} variant="outline" size="sm" className="gap-2">
                                    <RefreshCw className="w-4 h-4" /> Regenerar
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-base font-medium flex items-center gap-2">
                                        <UserX className="w-4 h-4" /> Ocultar Avatar Público
                                    </label>
                                    <p className="text-sm text-muted-foreground">Muestra un avatar genérico a otros usuarios.</p>
                                </div>
                                <Switch checked={hideAvatar} onCheckedChange={(v) => { setHideAvatar(v); persist('safespot_hide_avatar', v); }} />
                            </div>

                            <div className="border-t border-white/5 pt-6 flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <label className="text-base font-medium flex items-center gap-2">
                                        <Ghost className="w-4 h-4" /> Modo Fantasma
                                    </label>
                                    <p className="text-sm text-muted-foreground">Navega sin aparecer online (No sumas puntos de presencia).</p>
                                </div>
                                <Switch checked={ghostMode} onCheckedChange={(v) => { setGhostMode(v); persist('safespot_ghost_mode', v); }} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- DATA TAB (PHASE 4) --- */}
                <TabsContent value="data" className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                    <Card className="bg-dark-card border-dark-border">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Database className="w-5 h-5 text-blue-400" />
                                Almacenamiento Local
                            </CardTitle>
                            <CardDescription>Gestiona los datos guardados en tu navegador.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between border-b border-white/5 pb-6">
                                <div className="space-y-0.5">
                                    <h4 className="font-medium">Limpiar Cache de Datos</h4>
                                    <p className="text-sm text-muted-foreground">Recarga toda la información desde el servidor.</p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        queryClient.clear();
                                        window.location.reload();
                                    }}
                                    className="gap-2"
                                >
                                    <RefreshCw className="w-4 h-4" /> Limpiar
                                </Button>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <h4 className="font-medium text-red-400">Restablecer Aplicación</h4>
                                    <p className="text-sm text-muted-foreground">Borra todos tus ajustes y preferencias locales.</p>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm("¿Estás seguro? Se borrarán todos tus ajustes locales.")) {
                                            localStorage.clear();
                                            window.location.reload();
                                        }
                                    }}
                                    className="gap-2"
                                >
                                    <Trash2 className="w-4 h-4" /> Restablecer
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

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
                                <span className="font-mono">2.4.0-pro</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Estado del Servidor</span>
                                <span className="text-neon-green">En línea (Redis Optimized)</span>
                            </div>
                            <div className="flex justify-between border-t border-white/5 pt-4 mt-4">
                                <span className="text-muted-foreground">ID de Sesión</span>
                                <span className="font-mono text-[10px] opacity-50">{anonymousId.substring(0, 12)}...</span>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
