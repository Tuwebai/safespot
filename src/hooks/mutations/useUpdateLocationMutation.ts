import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi, geocodeApi, userZonesApi } from '@/lib/api';
import { queryKeys } from '@/lib/queryKeys';
import { logError } from '@/lib/logger';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';

interface LocationResult {
    lat: number;
    lng: number;
    formattedName: string;
    city?: string;
    province?: string;
}

interface UpdateLocationVariables {
    silent?: boolean;
}

export function useUpdateLocationMutation() {
    const queryClient = useQueryClient();

    return useMutation<LocationResult | null, Error, UpdateLocationVariables>({
        mutationFn: async ({ silent: _silent = false }) => {
            // --- HELPER: Format & Validate Location ---
            const formatLocation = (geo: { address?: { city?: string; municipality?: string; town?: string; village?: string; neighborhood?: string; suburb?: string; province?: string; state?: string; region?: string } } | null): string | null => {
                if (!geo || !geo.address) return null;
                const addr = geo.address;

                // STRICT FORMAT: "City, Province"
                const city = addr.city || addr.municipality || addr.town || addr.village || addr.neighborhood || addr.suburb || addr.province || addr.state;
                const province = addr.province || addr.state || addr.region;

                if (city && province) {
                    if (city.toLowerCase() === province.toLowerCase()) return `${city}, Argentina`;
                    const cleanProv = province.replace(/^Provincia de\s+/i, '');
                    return `${city}, ${cleanProv}`;
                }
                if (province) return `${province}, Argentina`;
                if (city) return `${city}, Argentina`;

                return null;
            };

            // --- HELPER: Save Location ---
            const saveLocation = async (lat: number, lng: number, formattedName: string, city?: string, prov?: string): Promise<LocationResult | null> => {
                // 1. Construir payload solo con valores válidos (no undefined, no NaN)
                const updates: Record<string, string | number> = {};
                
                if (typeof lat === 'number' && !isNaN(lat)) {
                    updates.last_known_lat = lat;
                }
                if (typeof lng === 'number' && !isNaN(lng)) {
                    updates.last_known_lng = lng;
                }
                if (city) {
                    updates.last_known_city = city;
                }
                if (prov) {
                    updates.last_known_province = prov;
                }
                
                // Guard clause: si no hay updates válidos, no-op silencioso
                // Esto pasa cuando GPS/IP no devuelven coords válidas (normal, no es error)
                if (Object.keys(updates).length === 0) {
                    console.warn('[Location] No valid updates to send, skipping API call');
                    return null;
                }

                // 2. Persistir en notification_settings (SSOT) y user_zones en paralelo
                const results = await Promise.allSettled([
                    notificationsApi.updateSettings(updates),
                    userZonesApi.updateCurrent(lat, lng, formattedName)
                ]);

                // Validar que el SSOT se guardó correctamente
                const settingsResult = results[0];
                if (settingsResult.status !== 'fulfilled') {
                    telemetry.emit({
                        engine: 'LocationPersistence',
                        severity: TelemetrySeverity.ERROR,
                        payload: {
                            action: 'location_save_failed',
                            error: settingsResult.reason instanceof Error ? settingsResult.reason.message : 'Unknown error',
                            hasCity: Boolean(city),
                            hasProvince: Boolean(prov)
                        }
                    });
                    throw new Error('Failed to persist location settings');
                }

                // 3. Invalidar cache
                await queryClient.invalidateQueries({ queryKey: queryKeys.notifications.settings });

                // 4. Telemetría de éxito
                telemetry.emit({
                    engine: 'LocationPersistence',
                    severity: TelemetrySeverity.INFO,
                    payload: {
                        action: 'location_saved',
                        source: 'notification_settings',
                        hasCity: Boolean(city),
                        hasProvince: Boolean(prov),
                        userZonesOk: results[1].status === 'fulfilled'
                    }
                });

                return { lat, lng, formattedName, city, province: prov };
            };

            // --- HELPER: Try GPS ---
            const tryGps = (): Promise<{ lat: number; lng: number } | null> => {
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

            // --- PIPELINE ---
            
            // A. Attempt GPS
            const coords = await tryGps();

            if (coords) {
                // B. Reverse Geocode GPS Coords
                const geo = await geocodeApi.reverse(coords.lat, coords.lng);
                const formatted = formatLocation(geo);

                if (formatted && geo?.address) {
                    console.log('[Location] ✅ GPS Success:', formatted);
                    return await saveLocation(
                        coords.lat, 
                        coords.lng, 
                        formatted, 
                        geo.address.city || geo.address.municipality, 
                        geo.address.province
                    );
                }

                console.warn('[Location] GPS Reverse failed/empty, falling back to IP');
            }

            // --- PIPELINE STEP 2: IP FALLBACK ---
            console.log('[Location] Attempting IP Fallback...');
            const ipGeo = await geocodeApi.getByIp();
            const ipFormatted = formatLocation(ipGeo);

            if (ipFormatted && ipGeo) {
                console.log('[Location] ✅ IP Fallback Success:', ipFormatted);
                return await saveLocation(
                    Number(ipGeo.lat),
                    Number(ipGeo.lon),
                    ipFormatted,
                    ipGeo.address.city,
                    ipGeo.address.province
                );
            }

            // --- PIPELINE STEP 3: ULTIMATE FAILURE ---
            console.error('[Location] All methods failed');
            return null;
        },
        onError: (err) => {
            logError(err, 'useUpdateLocationMutation');
        },
    });
}
