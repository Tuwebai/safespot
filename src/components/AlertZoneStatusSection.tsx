import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Home, Briefcase, MapPin, ShieldAlert, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserZones } from '@/hooks/useUserZones';

export function AlertZoneStatusSection() {
    const { zones, isLoading } = useUserZones();

    const zoneTypes = [
        { key: 'home', label: 'Casa', icon: Home, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
        { key: 'work', label: 'Trabajo', icon: Briefcase, color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
        { key: 'frequent', label: 'Frecuente', icon: MapPin, color: 'text-amber-500', bgColor: 'bg-amber-500/10' }
    ];

    if (isLoading) return null;

    return (
        <Card className="bg-dark-card border-dark-border border-neon-green/10 shadow-lg overflow-hidden">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <ShieldAlert className="h-5 w-5 text-neon-green" />
                    Modo Alerta por Zonas
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Grid horizontal en desktop, vertical en mobile */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {zoneTypes.map((type) => {
                        const zone = zones.find(z => z.type === type.key);
                        const Icon = type.icon;

                        return (
                            <div key={type.key} className="flex items-center justify-between p-3 rounded-xl bg-dark-bg/50 border border-white/5">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${type.bgColor}`}>
                                        <Icon className={`w-4 h-4 ${type.color}`} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-semibold text-foreground">{type.label}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase tracking-wider">
                                            {zone ? `${zone.radius_meters}m` : 'Sin config.'}
                                        </div>
                                    </div>
                                </div>

                                {!zone ? (
                                    <Link to="/explorar" state={{ activateZoneType: type.key }}>
                                        <Button variant="ghost" size="sm" className="h-8 text-neon-green hover:text-neon-green hover:bg-neon-green/10 gap-1 text-xs px-2">
                                            <ChevronRight className="w-3 h-3" />
                                        </Button>
                                    </Link>
                                ) : (
                                    <div className="w-2 h-2 rounded-full bg-neon-green" />
                                )}
                            </div>
                        );
                    })}
                </div>

                <Link to="/explorar">
                    <Button variant="outline" className="w-full text-xs h-9 border-white/10 hover:bg-white/5">
                        Gestionar en el Mapa
                    </Button>
                </Link>
            </CardContent>
        </Card>
    );
}
