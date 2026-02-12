/**
 * 🏛️ SAFE MODE: LocationSection - Componente Visual con SSOT
 * 
 * Lee ubicación desde anonymous_users (SSOT) via useProfileQuery.
 * No depende de notification_settings para datos de ubicación.
 * 
 * @version 2.0 - SSOT Location
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useProfileQuery } from '@/hooks/queries/useProfileQuery';

// 🏛️ SAFE MODE: TTL configurable para frescura de ubicación (read-only)
// 7 días en milisegundos - solo afecta UI, no borra ni modifica nada
const LOCATION_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface LocationSectionProps {
    /** Nombre formateado de la ubicación (opcional, para override) */
    locationName?: string | null;
    /** Estado de guardado de ubicación en progreso */
    savingLocation: boolean;
    /** Estado de geocodificación en progreso */
    isGeocoding: boolean;
    /** Estado del permiso del navegador */
    permissionStatus: PermissionState;
    /** Callback para actualizar ubicación */
    onUpdateLocation: () => void;
}

/**
 * 🏛️ SAFE MODE: Determina si existe una ubicación válida en SSOT
 * Lee desde anonymous_users (current_city) en lugar de notification_settings
 */
function hasValidLocationSSOT(currentCity?: string | null, lastGeoUpdate?: string | null): boolean {
    return !!currentCity && !!lastGeoUpdate;
}

/**
 * 🏛️ SAFE MODE: Determina si la ubicación está desactualizada (stale)
 * Usa last_geo_update desde SSOT (anonymous_users)
 */
function isLocationStaleSSOT(lastGeoUpdate?: string | null): boolean {
    if (!lastGeoUpdate) return false; // Sin fecha = no sabemos = asumimos fresh
    const updatedAt = new Date(lastGeoUpdate).getTime();
    const now = Date.now();
    return now - updatedAt > LOCATION_STALE_TTL_MS;
}

/**
 * Formatea nombre de ubicación desde SSOT
 */
function formatLocationName(currentCity?: string | null, currentProvince?: string | null): string | null {
    if (!currentCity) return null;
    if (!currentProvince || currentCity === currentProvince) return currentCity;
    return `${currentCity}, ${currentProvince}`;
}

export function LocationSection({
    locationName: locationNameOverride,
    savingLocation,
    isGeocoding,
    permissionStatus,
    onUpdateLocation
}: LocationSectionProps) {
    // 🏛️ SAFE MODE: SSOT - Leer ubicación desde anonymous_users via profile
    const { data: profile, isLoading: isLoadingProfile } = useProfileQuery();

    // Datos desde SSOT
    const currentCity = profile?.current_city;
    const currentProvince = profile?.current_province;
    const lastGeoUpdate = profile?.last_geo_update;

    // Derivar estado
    const locationExists = hasValidLocationSSOT(currentCity, lastGeoUpdate);
    const locationStale = isLocationStaleSSOT(lastGeoUpdate);
    const displayLocationName = locationNameOverride ?? formatLocationName(currentCity, currentProvince);

    // Loading state
    if (isLoadingProfile) {
        return (
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
    }

    return (
        <Card className="bg-dark-card border-dark-border">
            <CardHeader className="pb-4">
                <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-neon-green" />
                    <CardTitle className="text-base font-semibold">Mi Ubicación</CardTitle>
                </div>
                <CardDescription className="text-xs text-muted-foreground">
                    Tu ubicación se usa para alertas de proximidad y reportes locales
                </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4">
                <div className="p-4 rounded-lg bg-dark-bg border border-dark-border">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5">
                            <MapPin className="h-4 w-4 text-neon-green" />
                        </div>
                        <div className="flex-1">
                            <p className="text-xs font-semibold mb-1">Ubicación guardada</p>

                            {locationExists ? (
                                <>
                                    <p className="text-xs text-muted-foreground mb-1">
                                        {displayLocationName ? (
                                            <span className="text-foreground font-medium">{displayLocationName}</span>
                                        ) : (
                                            "Ubicación detectada"
                                        )}
                                    </p>
                                    {lastGeoUpdate && (
                                        <p className="text-[10px] text-muted-foreground/70 mb-3">
                                            Actualizado {formatDistanceToNow(new Date(lastGeoUpdate), { addSuffix: true, locale: es })}
                                            {locationStale && (
                                                <span className="ml-2 text-amber-400" title="Ubicación desactualizada - considerá actualizarla">
                                                    ⚠️ Desactualizada
                                                </span>
                                            )}
                                        </p>
                                    )}
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs border-neon-green/30 hover:bg-neon-green/5"
                                        onClick={onUpdateLocation}
                                        disabled={savingLocation || isGeocoding}
                                    >
                                        {savingLocation || isGeocoding ? "Actualizando..." : "Actualizar ubicación"}
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                                        {permissionStatus === 'granted'
                                            ? "Detectamos tu ubicación, pero todavía no la guardamos."
                                            : "No tenemos acceso a tu ubicación. Configúrala para recibir alertas locales."}
                                    </p>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-8 text-xs border-neon-green/30 hover:bg-neon-green/5"
                                        onClick={onUpdateLocation}
                                        disabled={savingLocation}
                                    >
                                        {savingLocation ? "Guardando..." : (permissionStatus === 'granted' ? "Guardar ubicación" : "Configurar ubicación")}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
