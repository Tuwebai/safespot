import { useEffect } from 'react';

interface AdBannerProps {
    className?: string;
}

/**
 * Componente para mostrar anuncios de Google AdSense.
 * 
 * IMPORTANTE: Requiere que el dominio esté aprobado en la consola de AdSense
 * y que el script oficial esté cargado en index.html.
 */
export const AdBanner = ({ className = "" }: AdBannerProps) => {
    useEffect(() => {
        // Solo intentar cargar en producción o si window.adsbygoogle existe
        if (typeof window !== 'undefined') {
            try {
                // @ts-ignore
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            } catch (e) {
                console.error('Error al cargar AdSense:', e);
            }
        }
    }, []);

    return (
        <div className={`ad-wrapper w-full overflow-hidden transition-all duration-300 ${className}`}>
            <div className="bg-card/30 rounded-3xl border border-border/50 p-4 min-h-[140px] md:min-h-[180px] flex flex-col items-center justify-center relative group backdrop-blur-md">
                {/* Etiqueta de Publicidad Adaptativa */}
                <div className="absolute top-0 right-10 transform -translate-y-1/2 z-10">
                    <span className="bg-primary text-[10px] font-bold text-primary-foreground px-3 py-1 rounded-full border border-primary/20 uppercase tracking-[0.15em] shadow-lg">
                        Publicidad
                    </span>
                </div>

                {/* Bloque de AdSense */}
                <ins
                    className="adsbygoogle"
                    style={{ display: 'block', width: '100%', minHeight: '90px' }}
                    data-ad-client="ca-pub-4693865721377675"
                    data-ad-slot="XXXXXXXXXX"
                    data-ad-format="auto"
                    data-full-width-responsive="true"
                />

                {/* Placeholder elegante que adapta su color al acento del tema */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity overflow-hidden rounded-[2rem]">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent -translate-x-full group-hover:animate-shimmer" />
                    <div className="flex flex-col items-center gap-1 opacity-40">
                        <span className="text-[11px] font-bold text-primary tracking-[0.3em] uppercase">
                            SafeSpot
                        </span>
                        <span className="text-[9px] font-medium text-muted-foreground tracking-[0.1em] uppercase">
                            Espacio Publicitario
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
