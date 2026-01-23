import React from 'react';
import { Lock, EyeOff, Server, Activity } from 'lucide-react';

export const TrustProof: React.FC = () => {
    return (
        <section className="w-full py-12 border-t border-border bg-muted/10">
            <div className="container mx-auto px-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">

                    {/* Metrica 1: Anonimato */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left p-4 rounded-xl hover:bg-accent transition-colors group">
                        <div className="flex items-center gap-2 mb-2 text-foreground group-hover:text-primary transition-colors">
                            <EyeOff className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold uppercase tracking-wider">Privacidad</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                            Tu identidad nunca se asocia públicamente a un reporte.
                        </p>
                    </div>

                    {/* Metrica 2: Infraestructura */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left p-4 rounded-xl hover:bg-accent transition-colors group">
                        <div className="flex items-center gap-2 mb-2 text-foreground group-hover:text-primary transition-colors">
                            <Lock className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold uppercase tracking-wider">Seguridad</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                            Encriptación de extremo a extremo en todos los datos sensibles.
                        </p>
                    </div>

                    {/* Metrica 3: Tiempo Real */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left p-4 rounded-xl hover:bg-accent transition-colors group">
                        <div className="flex items-center gap-2 mb-2 text-foreground group-hover:text-primary transition-colors">
                            <Activity className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold uppercase tracking-wider">Latencia</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                            Alertas distribuidas en &lt;200ms a dispositivos cercanos.
                        </p>
                    </div>

                    {/* Metrica 4: Data Sovereignty */}
                    <div className="flex flex-col items-center md:items-start text-center md:text-left p-4 rounded-xl hover:bg-accent transition-colors group">
                        <div className="flex items-center gap-2 mb-2 text-foreground group-hover:text-primary transition-colors">
                            <Server className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                            <span className="text-xs font-bold uppercase tracking-wider">Infraestructura</span>
                        </div>
                        <p className="text-sm text-muted-foreground font-medium group-hover:text-foreground transition-colors">
                            Servidores seguros monitoreados 24/7. Sin tracking comercial.
                        </p>
                    </div>

                </div>
            </div>
        </section>
    );
};
