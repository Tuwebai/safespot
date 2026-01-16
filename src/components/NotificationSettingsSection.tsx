import { useState, useEffect } from 'react';
import { notificationsApi, NotificationSettings, geocodeApi, usersApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { Bell, MapPin, Shield, Zap, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { usePushNotifications } from '@/hooks/usePushNotifications';

export function NotificationSettingsSection() {
    const [settings, setSettings] = useState<NotificationSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [permissionStatus, setPermissionStatus] = useState<PermissionState>('prompt');
    const [locationName, setLocationName] = useState<string | null>(null);
    const [isGeocoding, setIsGeocoding] = useState(false);
    const { success, error, info } = useToast();
    const { isSubscribed, subscribe, updateServiceLocation } = usePushNotifications();

    useEffect(() => {
        const loadSettings = async () => {
            try {
                const data = await notificationsApi.getSettings();
                setSettings(data);

                // Initialize location name from settings if available
                if (data) {
                    const parts = [data.last_known_city, data.last_known_province].filter(Boolean);
                    if (parts.length > 0) {
                        setLocationName(parts.join(', '));
                    }
                }
            } catch (err) {
                console.error('Failed to load settings:', err);
                setLoadError(true);
            } finally {
                setLoading(false);
            }
        };
        loadSettings();

        // Check Permissions
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'geolocation' }).then((result) => {
                setPermissionStatus(result.state);

                result.onchange = () => {
                    setPermissionStatus(result.state);
                };
            });
        }
    }, []);

    // AUTO-DETECT LOCATION IF MISSING (Enterprise Requirement)
    useEffect(() => {
        if (!loading && !locationName && settings && !loadError && !saving) {
            // Only auto-detect if we literally have NO location
            // and we haven't tried yet (avoid loops)
            console.log('[Location] Auto-detecting missing location...');
            handleUpdateLocation(true); // Pass flag to indicate silent/auto mode
        }
    }, [loading, locationName, settings, loadError]);

    const handleToggle = async (key: keyof NotificationSettings) => {
        if (!settings) return;

        const newVal = !settings[key];
        const updated = { ...settings, [key]: newVal };

        // Logic specific to Proximity Alerts
        if (key === 'proximity_alerts' && newVal === true) {
            // 1. Ensure Push is Enabled
            if (!isSubscribed) {
                // We don't block on subscribe, but if it fails user sees error from hook
                subscribe();
            }

            // 2. Ensure Location is set
            if (!settings.last_known_lat || !settings.last_known_lng) {
                // Trigger location prompt immediately
                handleUpdateLocation();
                // We don't stop the toggle, we let it turn on, but location prompt appears
            }
        }

        // Optimistic update
        setSettings(updated);

        try {
            await notificationsApi.updateSettings({ [key]: newVal });
        } catch (err) {
            console.error('[Notifications UI] Backend response ERROR', err);
            // Rollback
            setSettings(settings);
            error('Error al actualizar ajustes');
        }
    };

    const handleRadiusChange = async (radius: number) => {
        if (!settings) return;
        const updated = { ...settings, radius_meters: radius };
        setSettings(updated);
        try {
            await notificationsApi.updateSettings({ radius_meters: radius });
        } catch (err) {
            setSettings(settings);
            error('Error al actualizar el radio');
        }
    };

    const handleUpdateLocation = async (isAuto: boolean | unknown = false) => {
        const silent = typeof isAuto === 'boolean' && isAuto === true;
        if (saving) return; // Prevent double taps or loops

        setSaving(true);
        setLoadError(false); // Reset error state
        if (!silent) info("Detectando ubicación...");

        // --- HELPER: Format & Validate Location ---
        const formatLocation = (geo: any): string | null => {
            if (!geo || !geo.address) return null;
            const addr = geo.address;

            // STRICT FORMAT: "City, Province"
            // We prioritize Municipality/City over everything else.
            const city = addr.city || addr.municipality || addr.town || addr.village || addr.neighborhood || addr.suburb || addr.province || addr.state; // Fallback to province as city if really needed
            const province = addr.province || addr.state || addr.region;

            if (city && province) {
                // Remove duplicates (e.g. "Córdoba, Córdoba")
                if (city.toLowerCase() === province.toLowerCase()) return `${city}, Argentina`;
                // Remove redundant "Provincia de"
                const cleanProv = province.replace(/^Provincia de\s+/i, '');
                return `${city}, ${cleanProv}`;
            }
            // If we have at least one (should be guaranteed by fallback to province above), return it
            if (province) return `${province}, Argentina`;
            if (city) return `${city}, Argentina`;

            return null; // Reject only if completely empty
            // User says: "Ejemplos válidos: Río Tercero, Córdoba". 
            // "PROHIBIDO: Texto genérico".
            // If we only have Province, returning "Córdoba, Argentina" is acceptable fallback.
            // If we have nothing, return null to trigger next fallback.
        };

        const saveLocation = async (lat: number, lng: number, formattedName: string, city?: string, prov?: string) => {
            // 2. Save location to User Profile (SSOT) - Enterprise Decoupling
            await usersApi.updateLocation({
                city: city || '',
                province: prov || '',
                lat,
                lng
            });

            // 3. Sync with Push Service (still needed for geo-push if we use it)
            updateServiceLocation(lat, lng);

            // 4. Update local state
            // We still update 'settings' state locally for immediate UI feedback 
            // even though the data lives in profile now.
            //Ideally, we should fetch profile again, but for optimistic UI we update here.
            setSettings(prev => prev ? {
                ...prev,
                // These are now just local cache/optimistic values, 
                // backend reads from anonymous_users.
                // We keep them in state to show 'Ubicación guardada: ...'
                last_known_lat: lat,
                last_known_lng: lng,
                last_known_city: city,
                last_known_province: prov,
                updated_at: new Date().toISOString()
            } : null);

            setLocationName(formattedName);
            if (!silent) success(`Ubicación actualizada: ${formattedName}`);
        };

        // --- PIPELINE STEP 1: GPS ---
        const tryGps = (): Promise<{ lat: number, lng: number } | null> => {
            return new Promise((resolve) => {
                if (!navigator.geolocation) return resolve(null);

                navigator.geolocation.getCurrentPosition(
                    (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => {
                        console.warn('[Location] GPS Error:', err.message);
                        resolve(null);
                    },
                    { timeout: 8000, enableHighAccuracy: true, maximumAge: 0 }
                );
            });
        };

        try {
            // A. Attempt GPS
            const coords = await tryGps();

            if (coords) {
                setPermissionStatus('granted'); // We got coords, so granted/prompt-accepted

                setIsGeocoding(true);
                // B. Reverse Geocode GPS Coords
                const geo = await geocodeApi.reverse(coords.lat, coords.lng);
                const formatted = formatLocation(geo);

                if (formatted && geo?.address) {
                    await saveLocation(coords.lat, coords.lng, formatted, geo.address.city || geo.address.municipality, geo.address.province);
                    console.log('[Location] ✅ GPS Success:', formatted);
                    return; // SUCCESS EXIT
                }

                // If Reverse failed but we have Coords... 
                // We could fallback to IP for NAME, but we have precise COORDS.
                // However, user mandates "PROHIBIDO ... coordenadas ... texto genérico".
                // We MUST have a name. One retry via IP for name only? 
                // Using IP coords + IP name is safer consistency-wise than GPS coords + IP name (mismatch).
                // So if Reverse fails, we consider GPS 'partial fail' and fall through to IP.
                console.warn('[Location] GPS Reverse failed/empty, falling back to IP');
            }

            // --- PIPELINE STEP 2: IP FALLBACK ---
            // If GPS denied, timed out, OR Reverse failed.


            console.log('[Location] Attempting IP Fallback...');
            const ipGeo = await geocodeApi.getByIp();
            const ipFormatted = formatLocation(ipGeo);

            if (ipFormatted && ipGeo) {
                // ipGeo is the resolved object (lat, lon, address), unwrap check passed.

                await saveLocation(
                    Number(ipGeo.lat),
                    Number(ipGeo.lon),
                    ipFormatted,
                    ipGeo.address.city,
                    ipGeo.address.province
                );
                console.log('[Location] ✅ IP Fallback Success:', ipFormatted);
                return; // SUCCESS EXIT
            }

            // --- PIPELINE STEP 3: ULTIMATE FAILURE ---
            // Both GPS and IP failed. This implies network is practically dead or API down.
            console.error('[Location] All methods failed');
            if (!silent) error('No se pudo determinar tu ubicación. Verificá tu conexión.');

        } catch (e) {
            console.error('[Location] Critical Pipeline Error:', e);
            error('Hubo un error al actualizar la ubicación.');
        } finally {
            setSaving(false);
            setIsGeocoding(false);
        }
    };

    if (loading) return (
        <Card className="bg-dark-card border-dark-border">
            <CardContent className="p-6">
                <div className="flex items-center space-x-4 animate-pulse">
                    <div className="h-10 w-10 rounded-full bg-dark-border/50"></div>
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-dark-border/50 rounded w-3/4"></div>
                        <div className="h-3 bg-dark-border/50 rounded w-1/2"></div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loadError) return (
        <Card className="bg-dark-card border-dark-border border-red-900/20">
            <CardContent className="p-6 text-center">
                <p className="text-red-400 mb-2">No se pudieron cargar tus ajustes</p>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.location.reload()}
                    className="border-red-900/30 hover:bg-red-900/10"
                >
                    Reintentar
                </Button>
            </CardContent>
        </Card>
    );

    // --- Safe Location Helpers ---
    const getSafeLat = () => {
        if (!settings?.last_known_lat) return null;
        const val = Number(settings.last_known_lat);
        return isNaN(val) ? null : val;
    };
    const getSafeLng = () => {
        if (!settings?.last_known_lng) return null;
        const val = Number(settings.last_known_lng);
        return isNaN(val) ? null : val;
    };

    const safeLat = getSafeLat();
    const safeLng = getSafeLng();
    const hasValidLocation = safeLat !== null && safeLng !== null;

    return (
        <Card id="notificaciones" className="bg-dark-card border-dark-border overflow-hidden">
            <CardHeader className="border-b border-dark-border bg-dark-card">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-neon-green/10">
                        <Bell className="h-5 w-5 text-neon-green" />
                    </div>
                    <div>
                        <CardTitle className="text-xl">Notificaciones Inteligentes</CardTitle>
                        <CardDescription>Elegí qué alertas querés recibir en la campana</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                {/* Toggles */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-dark-bg border border-dark-border group-hover:border-neon-green/30 transition-colors">
                                <MapPin className="h-4 w-4 text-orange-500" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">Alertas de Proximidad</p>
                                <p className="text-xs text-muted-foreground">Nuevos reportes cerca de tu zona</p>
                            </div>
                        </div>
                        <ToggleButton
                            active={settings?.proximity_alerts || false}
                            onClick={() => handleToggle('proximity_alerts')}
                        />
                    </div>

                    <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-dark-bg border border-dark-border group-hover:border-neon-green/30 transition-colors">
                                <Zap className="h-4 w-4 text-neon-green" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">Actividad en mis Reportes</p>
                                <p className="text-xs text-muted-foreground">Comentarios y avistamientos en lo que subiste</p>
                            </div>
                        </div>
                        <ToggleButton
                            active={settings?.report_activity || false}
                            onClick={() => handleToggle('report_activity')}
                        />
                    </div>

                    <div className="flex items-center justify-between group">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-full bg-dark-bg border border-dark-border group-hover:border-neon-green/30 transition-colors">
                                <Shield className="h-4 w-4 text-blue-500" />
                            </div>
                            <div>
                                <p className="font-medium text-sm">Casos Similares</p>
                                <p className="text-xs text-muted-foreground">Alertas de robos del mismo tipo en tu zona</p>
                            </div>
                        </div>
                        <ToggleButton
                            active={settings?.similar_reports || false}
                            onClick={() => handleToggle('similar_reports')}
                        />
                    </div>
                </div>

                {/* Radius Selector */}
                {(settings?.proximity_alerts || settings?.similar_reports) && (
                    <div className="pt-6 border-t border-dark-border space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                        <div>
                            <p className="font-medium text-sm mb-2">Radio de alertas: {settings.radius_meters >= 1000 ? `${settings.radius_meters / 1000} km` : `${settings.radius_meters} m`}</p>
                            <p className="text-xs text-muted-foreground mb-3">(Aplica a reportes cercanos y casos similares)</p>
                            <div className="flex gap-2">
                                {[500, 1000, 2000, 5000].map(r => (
                                    <button
                                        key={r}
                                        onClick={() => handleRadiusChange(r)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-md text-xs font-medium transition-all border",
                                            settings.radius_meters === r
                                                ? "bg-neon-green text-dark-bg border-neon-green"
                                                : "bg-dark-bg text-muted-foreground border-dark-border hover:border-neon-green/50"
                                        )}
                                    >
                                        {r >= 1000 ? `${r / 1000}km` : `${r}m`}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="p-4 rounded-lg bg-dark-bg border border-dark-border">
                            <div className="flex items-start gap-3">
                                <div className="mt-0.5">
                                    <MapPin className="h-4 w-4 text-neon-green" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-semibold mb-1">Tu zona de alertas</p>

                                    {/* STATE A: Stored Location (Valid) */}
                                    {hasValidLocation ? (
                                        <>
                                            <p className="text-xs text-muted-foreground mb-1">
                                                Ubicación guardada: <span className="text-foreground font-medium">{locationName || "..."}</span>
                                            </p>
                                            {settings.updated_at && (
                                                <p className="text-[10px] text-muted-foreground/70 mb-3">
                                                    Actualizado {formatDistanceToNow(new Date(settings.updated_at), { addSuffix: true, locale: es })}
                                                </p>
                                            )}
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs border-neon-green/30 hover:bg-neon-green/5"
                                                onClick={() => handleUpdateLocation(false)}
                                                disabled={saving || isGeocoding}
                                            >
                                                {saving || isGeocoding ? "Actualizando..." : "Actualizar mi zona"}
                                            </Button>
                                        </>
                                    ) : (
                                        /* STATE B & C: No Stored Location or Invalid */
                                        <>
                                            <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                                {permissionStatus === 'granted'
                                                    ? "Detectamos tu ubicación, pero todavía no la guardamos."
                                                    : "No tenemos acceso a tu ubicación para enviarte alertas."}
                                            </p>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 text-xs border-neon-green/30 hover:bg-neon-green/5"
                                                onClick={() => handleUpdateLocation(false)}
                                                disabled={saving}
                                            >
                                                {saving ? "Guardando..." : (permissionStatus === 'granted' ? "Guardar mi zona" : "Activar ubicación")}
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/5 border border-orange-500/10">
                    <Info className="h-4 w-4 text-orange-500 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground leading-relaxed">
                        Para tu tranquilidad, las notificaciones son solo internas por ahora. Limitamos las alertas a un máximo de {settings?.max_notifications_per_day} por día para no distraerte.
                    </p>
                </div>
                <div className="text-[10px] text-muted-foreground/50 text-center font-mono">
                    ID: {typeof window !== 'undefined' ? localStorage.getItem('anonymous_id') : '...'}
                </div>
            </CardContent>
        </Card>
    );
}

function ToggleButton({ active, onClick }: { active: boolean, onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                active ? "bg-neon-green" : "bg-dark-bg border-dark-border"
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
