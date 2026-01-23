import React from 'react';
import { Shield, Activity, Users, Lock, EyeOff, Radio, Zap } from 'lucide-react';

export const OperationalFlow: React.FC = () => {
    return (
        <section className="w-full py-16 md:py-24 relative overflow-hidden bg-background border-b border-border">
            {/* Background Tech Elements */}
            <div className="absolute inset-0 pointer-events-none opacity-30">
                <div className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-border to-transparent" />
                <div className="absolute top-0 right-1/4 w-px h-full bg-gradient-to-b from-transparent via-border to-transparent" />
            </div>

            <div className="container mx-auto px-4 relative z-10">

                {/* 1. Header Enterprise */}
                <div className="text-center mb-16 max-w-3xl mx-auto">
                    <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">Protocolo Operativo</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight mb-4">
                        Cómo Opera SafeSpot
                    </h2>
                    <p className="text-muted-foreground text-lg leading-relaxed">
                        Un sistema diseñado para detectar, validar y actuar en tiempo real.
                    </p>
                </div>

                {/* 2. Process Flow Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12 relative max-w-6xl mx-auto mb-20">

                    {/* Visual Connector (Desktop) */}
                    <div className="hidden md:block absolute top-12 left-[16%] right-[16%] h-px bg-gradient-to-r from-border/50 via-primary/30 to-border/50 z-0" />

                    {/* Step 1: Detección */}
                    <div className="relative z-10 flex flex-col items-center text-center group">
                        <div className="w-24 h-24 rounded-2xl bg-card border border-border flex items-center justify-center mb-8 shadow-sm group-hover:shadow-[0_0_30px_rgba(var(--primary),0.1)] group-hover:border-primary/30 transition-all duration-500 relative">
                            <div className="absolute inset-0 bg-primary/5 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-500" />
                            <Shield className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                            <div className="absolute -bottom-3 px-3 py-1 bg-background border border-border rounded-full text-[10px] font-mono text-muted-foreground font-bold uppercase tracking-wider">
                                Detección
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-3">Reporte Anónimo</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                            Informás un incidente en segundos.<br />
                            Tu identidad nunca se expone.
                        </p>
                    </div>

                    {/* Step 2: Procesamiento */}
                    <div className="relative z-10 flex flex-col items-center text-center group">
                        <div className="w-24 h-24 rounded-2xl bg-card border border-border flex items-center justify-center mb-8 shadow-sm group-hover:shadow-[0_0_30px_rgba(var(--neon-blue),0.1)] group-hover:border-blue-400/30 transition-all duration-500 relative">
                            <div className="absolute inset-0 bg-blue-500/5 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-500" />
                            <Activity className="w-10 h-10 text-muted-foreground group-hover:text-blue-400 transition-colors duration-300" />
                            <div className="absolute -bottom-3 px-3 py-1 bg-background border border-border rounded-full text-[10px] font-mono text-muted-foreground font-bold uppercase tracking-wider">
                                Procesamiento
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-3">Validación Real-Time</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                            El sistema procesa y publica la alerta<br />
                            al instante en el mapa.
                        </p>
                    </div>

                    {/* Step 3: Acción */}
                    <div className="relative z-10 flex flex-col items-center text-center group">
                        <div className="w-24 h-24 rounded-2xl bg-card border border-border flex items-center justify-center mb-8 shadow-sm group-hover:shadow-[0_0_30px_rgba(var(--primary),0.1)] group-hover:border-primary/30 transition-all duration-500 relative">
                            <div className="absolute inset-0 bg-primary/5 rounded-2xl scale-0 group-hover:scale-100 transition-transform duration-500" />
                            <Users className="w-10 h-10 text-muted-foreground group-hover:text-primary transition-colors duration-300" />
                            <div className="absolute -bottom-3 px-3 py-1 bg-background border border-border rounded-full text-[10px] font-mono text-muted-foreground font-bold uppercase tracking-wider">
                                Acción
                            </div>
                        </div>
                        <h3 className="text-xl font-bold text-foreground mb-3">Respuesta Colectiva</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                            La comunidad reacciona, evita riesgos<br />
                            y recupera zonas.
                        </p>
                    </div>

                </div>

                {/* 3. Integrated Trust Layer */}
                <div className="border-t border-border pt-12 max-w-5xl mx-auto">
                    <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 mb-8">

                        <div className="flex items-center gap-2 group">
                            <EyeOff className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">Anonimato por diseño</span>
                        </div>

                        <div className="flex items-center gap-2 group">
                            <Lock className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">Infraestructura segura</span>
                        </div>

                        <div className="flex items-center gap-2 group">
                            <Zap className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">Datos en tiempo real</span>
                        </div>

                        <div className="flex items-center gap-2 group">
                            <Radio className="w-4 h-4 text-muted-foreground/70 group-hover:text-foreground transition-colors" />
                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wider">Sin tracking personal</span>
                        </div>

                    </div>

                    <p className="text-center text-sm font-medium text-muted-foreground/60 border-t border-border/50 pt-6 inline-block w-full">
                        SafeSpot protege personas, no perfiles.
                    </p>
                </div>

            </div>
        </section>
    );
};
