/**
 * 🏛️ SAFE MODE: EmptyCommunityState - Empty States Enterprise
 * 
 * 4 variantes contextuales para máxima conversión:
 * - location_missing: Sin ubicación configurada
 * - nearby_empty: Ubicación OK pero sin usuarios cercanos
 * - global_empty: Sin usuarios en toda la plataforma
 * - search_empty: Búsqueda sin resultados
 * 
 * @version 2.0 - SSOT + Contextual
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MapPin, Globe, SearchX, Share2 } from 'lucide-react';

export type EmptyStateVariant = 'location_missing' | 'nearby_empty' | 'global_empty' | 'search_empty';

interface EmptyCommunityStateProps {
    variant: EmptyStateVariant;
    locality?: string | null;
    query?: string;
    onClearSearch?: () => void;
}

// Animación de radar para location_missing
function RadarAnimation() {
    return (
        <div className="relative w-24 h-24 mx-auto mb-6">
            {/* Círculos concéntricos */}
            <div className="absolute inset-0 rounded-full border border-neon-green/20" />
            <div className="absolute inset-2 rounded-full border border-neon-green/30" />
            <div className="absolute inset-4 rounded-full border border-neon-green/40" />
            {/* Punto central */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 bg-neon-green rounded-full animate-pulse" />
            </div>
            {/* Línea de radar rotando */}
            <div className="absolute inset-0 rounded-full overflow-hidden">
                <div 
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-neon-green/20 to-transparent"
                    style={{
                        animation: 'radar-spin 2s linear infinite',
                        transformOrigin: 'center'
                    }}
                />
            </div>
            <style>{`
                @keyframes radar-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}

// Mapa solitario para nearby_empty
function LonelyMapAnimation(_props: { locality?: string | null }) {
    return (
        <div className="relative w-32 h-32 mx-auto mb-6">
            {/* Radio de búsqueda */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-neon-green/20 animate-pulse" />
            <div className="absolute inset-4 rounded-full border border-neon-green/10" />
            
            {/* Pin central */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                    <MapPin className="w-8 h-8 text-neon-green" />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-neon-green rounded-full animate-ping" />
                </div>
            </div>
            
            {/* Ondas de sonar */}
            <div className="absolute inset-0 rounded-full border border-neon-green/30 animate-ping" style={{ animationDuration: '2s' }} />
        </div>
    );
}

// Globo con semillas para global_empty
function SeedGlobeAnimation() {
    return (
        <div className="relative w-28 h-28 mx-auto mb-6">
            {/* Globo */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-br from-neon-green/20 to-transparent border border-neon-green/30" />
            <div className="absolute inset-2 rounded-full border border-neon-green/20" />
            
            {/* Líneas de latitud/longitud estilizadas */}
            <div className="absolute inset-0 flex items-center justify-center">
                <Globe className="w-12 h-12 text-neon-green/60" />
            </div>
            
            {/* Semillas flotando */}
            <div className="absolute -top-1 right-2 w-2 h-2 bg-neon-green rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
            <div className="absolute top-4 -right-1 w-1.5 h-1.5 bg-neon-green/70 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="absolute -left-1 bottom-6 w-2 h-2 bg-neon-green/50 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
        </div>
    );
}

// Búsqueda triste para search_empty
function SadSearchAnimation() {
    return (
        <div className="relative w-24 h-24 mx-auto mb-6">
            <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                    <SearchX className="w-12 h-12 text-muted-foreground" />
                    {/* Carita triste */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                        <div className="flex gap-1">
                            <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                            <div className="w-1 h-1 bg-muted-foreground rounded-full" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export function EmptyCommunityState({ 
    variant, 
    locality, 
    query,
    onClearSearch 
}: EmptyCommunityStateProps) {
    const navigate = useNavigate();

    // Variante: Sin ubicación configurada
    if (variant === 'location_missing') {
        return (
            <div className="flex flex-col items-center text-center py-12 px-4">
                <RadarAnimation />
                
                <h3 className="text-xl font-bold text-foreground mb-2">
                    Activá tu ubicación para conectar
                </h3>
                
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                    Con tu ciudad podés:
                </p>
                
                <ul className="text-sm text-muted-foreground mb-6 space-y-2 text-left max-w-xs">
                    <li className="flex items-center gap-2">
                        <span className="text-neon-green">•</span>
                        Ver usuarios cercanos
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="text-neon-green">•</span>
                        Recibir alertas locales
                    </li>
                    <li className="flex items-center gap-2">
                        <span className="text-neon-green">•</span>
                        Colaborar con tu comunidad
                    </li>
                </ul>
                
                <Button
                    onClick={() => navigate('/ajustes')}
                    className="bg-neon-green text-dark-bg hover:bg-neon-green/90"
                >
                    <MapPin className="w-4 h-4 mr-2" />
                    Configurar Ubicación
                </Button>
                
                <p className="text-xs text-muted-foreground/60 mt-4 flex items-center gap-1">
                    <span className="text-neon-green">🔒</span>
                    Tu ubicación exacta nunca se comparte. Solo usamos la ciudad.
                </p>
            </div>
        );
    }

    // Variante: Ubicación OK pero sin usuarios cercanos
    if (variant === 'nearby_empty') {
        return (
            <div className="flex flex-col items-center text-center py-12 px-4">
                <LonelyMapAnimation locality={locality} />
                
                <h3 className="text-xl font-bold text-foreground mb-2">
                    Sos de los primeros en {locality || 'tu ciudad'}
                </h3>
                
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                    No hay otros usuarios de tu ciudad todavía. ¡Sé el pionero!
                </p>
                
                <div className="flex flex-col gap-3 w-full max-w-xs">
                    <Button
                        onClick={() => {
                            const url = `https://safespot.tuweb-ai.com`;
                            navigator.clipboard.writeText(url);
                        }}
                        variant="outline"
                        className="border-neon-green/30 hover:bg-neon-green/5"
                    >
                        <Share2 className="w-4 h-4 mr-2" />
                        Invitar amigos de {locality || 'tu ciudad'}
                    </Button>
                    
                    <Button
                        variant="ghost"
                        onClick={() => {}}
                        className="text-muted-foreground hover:text-foreground"
                    >
                        <Globe className="w-4 h-4 mr-2" />
                        Ver comunidad global
                    </Button>
                </div>
                
                <p className="text-xs text-muted-foreground/60 mt-4">
                    💡 Compartí en grupos de WhatsApp de tu barrio para sumar más gente
                </p>
            </div>
        );
    }

    // Variante: Sin usuarios en toda la plataforma
    if (variant === 'global_empty') {
        return (
            <div className="flex flex-col items-center text-center py-12 px-4">
                <SeedGlobeAnimation />
                
                <h3 className="text-xl font-bold text-foreground mb-2">
                    La comunidad está naciendo
                </h3>
                
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">
                    SafeSpot es nuevo y vos sos parte de los fundadores.
                </p>
                
                <Button
                    onClick={() => {
                        const url = `https://safespot.tuweb-ai.com`;
                        navigator.clipboard.writeText(url);
                    }}
                    className="bg-neon-green text-dark-bg hover:bg-neon-green/90"
                >
                    <RocketIcon className="w-4 h-4 mr-2" />
                    Ser el primer usuario
                </Button>
                
                <p className="text-xs text-muted-foreground/60 mt-4">
                    🏗️ Cuando más gente se sume, más segura será la red
                </p>
            </div>
        );
    }

    // Variante: Búsqueda sin resultados
    return (
        <div className="flex flex-col items-center text-center py-12 px-4">
            <SadSearchAnimation />
            
            <h3 className="text-xl font-bold text-foreground mb-2">
                No encontramos &quot;{query}&quot;
            </h3>
            
            <p className="text-sm text-muted-foreground mb-4">
                Probá con:
            </p>
            
            <ul className="text-sm text-muted-foreground mb-6 space-y-1 text-left max-w-xs">
                <li>• Búsqueda parcial (ej: &quot;Juan&quot;)</li>
                <li>• Sin tildes</li>
                <li>• Ver pestaña Global</li>
            </ul>
            
            {onClearSearch && (
                <Button
                    variant="outline"
                    onClick={onClearSearch}
                    className="border-neon-green/30 hover:bg-neon-green/5"
                >
                    Limpiar búsqueda
                </Button>
            )}
        </div>
    );
}

// Icono de cohete inline
function RocketIcon({ className }: { className?: string }) {
    return (
        <svg 
            className={className} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
        >
            <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
            <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
            <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
            <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
    );
}
