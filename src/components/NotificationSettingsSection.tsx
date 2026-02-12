import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Bell, MapPin, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { LocationSection } from './LocationSection';
// 🏛️ SAFE MODE: Hooks encapsulan APIs (nunca importar @/lib/api en UI)
import { useNotificationSettingsQuery } from '@/hooks/queries/useNotificationSettingsQuery';
import { useUpdateNotificationSettingsMutation } from '@/hooks/mutations/useUpdateNotificationSettingsMutation';
import { useUpdateLocationMutation } from '@/hooks/mutations/useUpdateLocationMutation';
import type { NotificationSettings } from '@/lib/api';

export function NotificationSettingsSection() {
    const { success, error } = useToast();
    const { isSubscribed, subscribe } = usePushNotifications();
    const { checkAuth } = useAuthGuard();
    
    // 🏛️ SAFE MODE: React Query hooks en lugar de API directa
    const { 
        data: settings, 
        isLoading: loading, 
        error: loadError,
        refetch 
    } = useNotificationSettingsQuery();
    
    const updateSettingsMutation = useUpdateNotificationSettingsMutation();
    const updateLocationMutation = useUpdateLocationMutation();

    // Estados UI locales (no de datos)
    const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
    const [locationName, setLocationName] = useState<string | null>(null);
    
    // 🏛️ SAFE MODE: sessionStorage sobrevive refresh (useRef no)
    const hasAutoDetected = sessionStorage.getItem('safespot_location_autodetected') === 'true';

    // Inicializar locationName desde settings cuando cargan
    useEffect(() => {
        if (settings) {
            const parts = [settings.last_known_city, settings.last_known_province].filter(Boolean);
            if (parts.length > 0) {
                setLocationName(parts.join(', '));
            }
        }
    }, [settings]);

    // Check Permissions
    useEffect(() => {
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                setPermissionStatus(result.state);
                result.onchange = () => {
                    setPermissionStatus(result.state);
                };
            });
        }
    }, []);

    // AUTO-DETECT LOCATION IF MISSING (idempotente con sessionStorage)
    useEffect(() => {
        if (hasAutoDetected) return; // 🔒 Solo una vez por sesión (sobrevive refresh)
        if (!loading && !locationName && settings && !updateLocationMutation.isPending) {
            sessionStorage.setItem('safespot_location_autodetected', 'true'); // 🔒 Persistir
            console.log('[Location] Auto-detecting missing location...');
            handleUpdateLocation(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, locationName, settings]);

    const handleToggle = async (key: keyof NotificationSettings) => {
        if (!settings || updateSettingsMutation.isPending) return;

        // 🔴 CRITICAL FIX: Block anonymous users
        if (!checkAuth()) {
            return;
        }

        const newVal = !settings[key];

        // Sugerir push subscription si activa proximidad
        if (key === 'proximity_alerts' && newVal === true && !isSubscribed) {
            subscribe();
        }

        updateSettingsMutation.mutate(
            { [key]: newVal },
            {
                onError: () => {
                    error('Error al actualizar ajustes');
                }
            }
        );
    };

    const handleRadiusChange = async (radius: number) => {
        if (!settings || updateSettingsMutation.isPending) return;

        if (!checkAuth()) {
            return;
        }

        updateSettingsMutation.mutate(
            { radius_meters: radius },
            {
                onError: () => {
                    error('Error al actualizar el radio');
                }
            }
        );
    };

    const handleUpdateLocation = async (isAuto: boolean | unknown = false) => {
        const silent = typeof isAuto === 'boolean' && isAuto === true;
        if (updateLocationMutation.isPending) return;

        if (!silent) {
            // Show loading via toast
        }

        updateLocationMutation.mutate(
            { silent },
            {
                onSuccess: (result) => {
                    if (result) {
                        setLocationName(result.formattedName);
                        if (!silent) {
                            success(`Ubicación actualizada: ${result.formattedName}`);
                        }
                    } else {
                        if (!silent) {
                            error('No se pudo determinar tu ubicación. Verificá tu conexión.');
                        }
                    }
                },
                onError: () => {
                    if (!silent) {
                        error('Hubo un error al actualizar la ubicación.');
                    }
                }
            }
        );
    };

    if (loading) return (
        <Card className="bg-card border-border">
            <CardContent className="p-4 sm:p-6">
                <div className="flex items-center gap-4 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-muted"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-3/4"></div>
                        <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loadError) return (
        <Card className="bg-card border-destructive/20">
            <CardContent className="p-4 sm:p-6 text-center">
                <p className="text-destructive mb-2">No se pudieron cargar tus ajustes</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void refetch()}
                    className="border-red-900/30 hover:bg-red-900/10"
                >
                    Reintentar
                </Button>
            </CardContent>
        </Card>
    );

    if (!settings) return null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <LocationSection
                locationName={locationName}
                savingLocation={updateLocationMutation.isPending}
                isGeocoding={updateLocationMutation.isPending}
                permissionStatus={permissionStatus}
                onUpdateLocation={() => handleUpdateLocation(false)}
            />

            <Card id="notificaciones" className="bg-card border-border overflow-hidden">
                <CardHeader className="border-b border-border bg-card p-4 sm:p-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary/10">
                            <Bell className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-xl">Notificaciones Inteligentes</CardTitle>
                            <CardDescription>Elegí qué alertas querés recibir</CardDescription>
                        </div>
                    </div>
                </CardHeader>

                <CardContent className="p-4 sm:p-6 pt-0">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {/* Proximidad */}
                        <div className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/30 transition-colors">
                            <div className="p-3 rounded-full bg-muted border border-border">
                                <MapPin className="h-5 w-5 text-orange-500" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">Alertas de Proximidad</p>
                                <p className="text-xs text-muted-foreground">Reportes cercanos</p>
                            </div>
                            <ToggleButton
                                active={settings.proximity_alerts || false}
                                onClick={() => handleToggle('proximity_alerts')}
                                disabled={updateSettingsMutation.isPending}
                            />
                        </div>

                        {/* Actividad */}
                        <div className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/30 transition-colors">
                            <div className="p-3 rounded-full bg-muted border border-border">
                                <Zap className="h-5 w-5 text-primary" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">Actividad en Reportes</p>
                                <p className="text-xs text-muted-foreground">Comentarios</p>
                            </div>
                            <ToggleButton
                                active={settings.report_activity || false}
                                onClick={() => handleToggle('report_activity')}
                                disabled={updateSettingsMutation.isPending}
                            />
                        </div>

                        {/* Casos similares */}
                        <div className="flex flex-col items-center text-center gap-3 p-4 rounded-xl bg-muted/50 border border-border hover:border-primary/30 transition-colors">
                            <div className="p-3 rounded-full bg-muted border border-border">
                                <Shield className="h-5 w-5 text-blue-500" />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm font-semibold">Casos Similares</p>
                                <p className="text-xs text-muted-foreground">Mismo tipo de robo</p>
                            </div>
                            <ToggleButton
                                active={settings.similar_reports || false}
                                onClick={() => handleToggle('similar_reports')}
                                disabled={updateSettingsMutation.isPending}
                            />
                        </div>
                    </div>

                    {/* Radius Selector */}
                    {(settings.proximity_alerts || settings.similar_reports) && (
                        <div className="pt-6 border-t border-border space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div>
                                <p className="font-medium text-sm mb-2">Radio de alertas: {settings.radius_meters >= 1000 ? `${settings.radius_meters / 1000} km` : `${settings.radius_meters} m`}</p>
                                <p className="text-xs text-muted-foreground mb-3">(Aplica a reportes cercanos y casos similares)</p>
                                <div className="flex gap-2">
                                    {[500, 1000, 2000, 5000].map(r => (
                                        <button
                                            key={r}
                                            onClick={() => handleRadiusChange(r)}
                                            disabled={updateSettingsMutation.isPending}
                                            className={cn(
                                                "px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                                                settings.radius_meters === r
                                                    ? "bg-primary text-primary-foreground border-primary"
                                                    : "bg-muted text-muted-foreground border-border hover:border-primary/50",
                                                updateSettingsMutation.isPending && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function ToggleButton({ active, onClick, disabled }: { active: boolean; onClick: () => void; disabled?: boolean }) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed",
                active ? "bg-primary" : "bg-muted border-border"
            )}
        >
            <span
                className={cn(
                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                    active ? "translate-x-5" : "translate-x-0"
                )}
            />
        </button>
    );
}
