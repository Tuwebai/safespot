/**
 * 🏛️ SAFE MODE: MapSettingsSection - Configuración del Mapa
 * 
 * Fase 2 del refactor enterprise: Sección de mapa extraída.
 * 
 * @version 1.0 - Extracción desde SettingsPage
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Map as MapIcon, Compass, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfileQuery } from '@/hooks/queries/useProfileQuery';
import { useUpdateProfileMutation } from '@/hooks/mutations/useUpdateProfileMutation';
import { useToast } from '@/components/ui/toast';

const mapStyles = [
    { id: 'streets', name: 'Calles' },
    { id: 'satellite', name: 'Satélite' },
    { id: 'hybrid', name: 'Híbrido' }
];

export function MapSettingsSection() {
    const toast = useToast();
    const { data: profile } = useProfileQuery();
    const updateProfile = useUpdateProfileMutation();

    const [mapStyle, setMapStyle] = useState('streets');
    const [autoCenter, setAutoCenter] = useState(true);
    const [interestRadius, setInterestRadius] = useState(1000);
    const [isSavingRadius, setIsSavingRadius] = useState(false);

    // Load from localStorage and profile
    useEffect(() => {
        setMapStyle(localStorage.getItem('safespot_map_style') || 'streets');
        setAutoCenter(localStorage.getItem('safespot_auto_center') !== 'false');
        if (profile?.interest_radius_meters) {
            setInterestRadius(profile.interest_radius_meters);
        }
    }, [profile]);

    const persist = (key: string, val: string | boolean) => {
        localStorage.setItem(key, String(val));
    };

    const handleSaveRadius = async () => {
        setIsSavingRadius(true);
        try {
            await updateProfile.mutateAsync({ interest_radius_meters: interestRadius });
            toast.success(`Burbuja de seguridad actualizada a ${interestRadius}m`);
            toast.info('Recarga la página de reportes para ver cambios con el nuevo radio');
        } catch (err) {
            // Error handled by mutation
        } finally {
            setIsSavingRadius(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Map Style */}
            <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-orange-500" />
                        Capas del Mapa
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                        {mapStyles.map((s) => (
                            <button
                                key={s.id}
                                onClick={() => { 
                                    setMapStyle(s.id); 
                                    persist('safespot_map_style', s.id); 
                                }}
                                className={cn(
                                    "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all",
                                    mapStyle === s.id 
                                        ? "bg-neon-green/10 border-neon-green text-neon-green" 
                                        : "bg-white/5 border-white/10 text-muted-foreground opacity-60 hover:opacity-100"
                                )}
                            >
                                <span className="text-xs font-bold uppercase tracking-wider">{s.name}</span>
                            </button>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* Interest Radius */}
            <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Compass className="w-5 h-5 text-neon-green" />
                        Burbuja de Seguridad
                    </CardTitle>
                    <CardDescription>
                        Radio de interés para notificaciones y feed de reportes.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="flex justify-between items-end">
                            <span className="text-sm font-medium">Distancia</span>
                            <span className="text-2xl font-bold text-neon-green">
                                {interestRadius >= 1000 
                                    ? `${(interestRadius / 1000).toFixed(1)}km` 
                                    : `${interestRadius}m`}
                            </span>
                        </div>
                        <Slider
                            min={500}
                            max={5000}
                            step={100}
                            value={interestRadius}
                            onValueChange={setInterestRadius}
                        />
                        <div className="flex justify-between text-[10px] text-muted-foreground uppercase tracking-widest">
                            <span>Personal</span>
                            <span>Barrial</span>
                            <span>Distrital</span>
                        </div>
                    </div>
                    <Button
                        onClick={handleSaveRadius}
                        disabled={isSavingRadius || interestRadius === profile?.interest_radius_meters}
                        className="w-full bg-neon-green/20 hover:bg-neon-green/30 text-neon-green border border-neon-green/30"
                    >
                        {isSavingRadius ? 'Guardando...' : 'Guardar Radio'}
                    </Button>
                </CardContent>
            </Card>

            {/* Auto-center */}
            <Card className="bg-dark-card border-dark-border">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <MapPin className="w-4 h-4" /> Comportamiento
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <label className="text-base font-medium">
                                Auto-centrar Mapa
                            </label>
                            <p className="text-sm text-muted-foreground">
                                Centra el mapa en tu ubicación al iniciar.
                            </p>
                        </div>
                        <Switch 
                            checked={autoCenter} 
                            onCheckedChange={(v) => { 
                                setAutoCenter(v); 
                                persist('safespot_auto_center', v); 
                            }} 
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
