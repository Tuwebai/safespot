/**
 * 🏛️ SAFE MODE: LocationSection - Componente Visual Independiente
 * 
 * Paso 5 del refactor enterprise: TTL de frescura de ubicación.
 * Solo lógica de lectura/UX, sin side-effects ni writes.
 * 
 * @version 1.1 - TTL de frescura (read-only)
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import type { NotificationSettings } from '@/lib/api';

// 🏛️ SAFE MODE: Paso 5 - TTL configurable para frescura de ubicación (read-only)
// 7 días en milisegundos - solo afecta UI, no borra ni modifica nada
const LOCATION_STALE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface LocationSectionProps {
    /** Nombre formateado de la ubicación (ciudad, provincia) */
    locationName: string | null;
    /** Settings del usuario (para timestamp y validación) */
    settings: NotificationSettings | null;
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
 * Determina si existe una ubicación válida guardada
 */
function hasValidLocation(settings: NotificationSettings | null): boolean {
    return !!settings?.last_known_lat && !!settings?.last_known_lng;
}

/**
 * 🏛️ SAFE MODE: Paso 5 - Determina si la ubicación está desactualizada (stale)
 * Solo lectura, NO modifica estado ni dispara side-effects
 */
function isLocationStale(settings: NotificationSettings | null): boolean {
    if (!settings?.updated_at) return false; // Sin fecha = no sabemos = asumimos fresh
    const updatedAt = new Date(settings.updated_at).getTime();
    const now = Date.now();
    return now - updatedAt > LOCATION_STALE_TTL_MS;
}

export function LocationSection({
    locationName,
    settings,
    savingLocation,
    isGeocoding,
    permissionStatus,
    onUpdateLocation
}: LocationSectionProps) {
    const locationExists = hasValidLocation(settings);
    // 🏛️ SAFE MODE: Paso 5 - Solo lectura, NO side-effects
    const locationStale = isLocationStale(settings);

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
                                        {locationName ? (
                                            <span className="text-foreground font-medium">{locationName}</span>
                                        ) : (
                                            "Ubicación detectada"
                                        )}
                                    </p>
                                    {settings?.updated_at && (
                                        <p className="text-[10px] text-muted-foreground/70 mb-3">
                                            Actualizado {formatDistanceToNow(new Date(settings.updated_at), { addSuffix: true, locale: es })}
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
