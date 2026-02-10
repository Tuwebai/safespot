/**
 * 🏛️ SAFE MODE: AppearanceSection - Configuración de Apariencia
 * 
 * Fase 2 del refactor enterprise: Sección de apariencia extraída.
 * 
 * @version 1.0 - Extracción desde SettingsPage
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Palette, Monitor, Eye, Map as MapIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

const themes = [
    { id: 'default', name: 'Original', color: 'bg-black border-neon-green' },
    { id: 'neon', name: 'Neon', color: 'bg-slate-900 border-purple-500' },
    { id: 'pastel', name: 'Pastel', color: 'bg-indigo-950 border-pink-400' },
    { id: 'minimal', name: 'Minimal', color: 'bg-neutral-900 border-gray-400' }
];

export function AppearanceSection() {
    const { theme, setTheme, openCustomizer, savePreferences } = useTheme();
    
    const [reducedMotion, setReducedMotion] = useState(false);
    const [mapDensity, setMapDensity] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        setReducedMotion(localStorage.getItem('safespot_reduced_motion') === 'true');
        setMapDensity(localStorage.getItem('safespot_map_density') === 'true');
    }, []);

    const persist = (key: string, val: string | boolean) => {
        localStorage.setItem(key, String(val));
    };

    const toggleReducedMotion = (val: boolean) => {
        setReducedMotion(val);
        persist('safespot_reduced_motion', val);
        if (val) document.documentElement.classList.add('reduce-motion');
        else document.documentElement.classList.remove('reduce-motion');
    };

    return (
        <div className="space-y-6">
            {/* Theme Selector */}
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
                        {themes.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => { setTheme(t.id as any); savePreferences(); }}
                                className={cn(
                                    "relative p-4 rounded-xl border-2 transition-all hover:scale-105",
                                    t.color,
                                    theme === t.id 
                                        ? "ring-2 ring-neon-green ring-offset-2 ring-offset-black" 
                                        : "border-white/10 opacity-60 hover:opacity-100"
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
                            onCheckedChange={(v) => { 
                                setMapDensity(v); 
                                persist('safespot_map_density', v); 
                            }}
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
