/**
 * 🏛️ SAFE MODE: SettingsLayout - Layout con Sidebar Vertical (Responsive)
 * 
 * Fase 3 Bugfix: Layout adaptativo - Select en mobile, Sidebar en desktop.
 * 
 * @version 1.1 - Responsive fix
 */

import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SettingsNavItem {
    id: string;
    label: string;
    icon: React.ReactNode;
}

export interface SettingsLayoutProps {
    /** Título de la página */
    title: string;
    /** Items de navegación */
    navItems: SettingsNavItem[];
    /** Item activo actual */
    activeSection: string;
    /** Callback al cambiar sección */
    onSectionChange: (section: string) => void;
    /** Contenido de la sección activa */
    children: React.ReactNode;
}

export function SettingsLayout({
    title,
    navItems,
    activeSection,
    onSectionChange,
    children
}: SettingsLayoutProps) {
    const navigate = useNavigate();

    // Encontrar label del item activo para el select
    const activeLabel = navItems.find(item => item.id === activeSection)?.label || '';

    return (
        <div className="container mx-auto max-w-6xl px-4 py-8">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => navigate('/perfil')}
                    className="rounded-full hover:bg-white/10"
                >
                    <ArrowLeft className="h-6 w-6" />
                </Button>
                <h1 className="text-2xl font-bold">{title}</h1>
            </div>

            {/* Layout: Sidebar (desktop) / Select (mobile) + Content */}
            <div className="flex flex-col lg:flex-row gap-8">
                {/* 
                    🏛️ SAFE MODE: Responsive navigation
                    Mobile: Select dropdown
                    Desktop: Sidebar vertical
                */}
                <div className="lg:w-64 shrink-0">
                    {/* Mobile: Select */}
                    <div className="lg:hidden">
                        <label className="text-sm font-medium text-muted-foreground mb-2 block">
                            Sección
                        </label>
                        <div className="relative">
                            <select
                                value={activeSection}
                                onChange={(e) => onSectionChange(e.target.value)}
                                className={cn(
                                    "w-full appearance-none rounded-lg border px-4 py-3 pr-10 text-sm",
                                    "bg-card border-border text-foreground",
                                    "focus:outline-none focus:ring-2 focus:ring-neon-green/50",
                                    "[color-scheme:dark]"
                                )}
                            >
                                {navItems.map((item) => (
                                    <option key={item.id} value={item.id}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                            {/* Custom arrow */}
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    width="16" 
                                    height="16" 
                                    viewBox="0 0 24 24" 
                                    fill="none" 
                                    stroke="currentColor" 
                                    strokeWidth="2" 
                                    strokeLinecap="round" 
                                    strokeLinejoin="round"
                                >
                                    <polyline points="6 9 12 15 18 9" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Desktop: Sidebar */}
                    <nav className="hidden lg:block">
                        <div className="space-y-1">
                            {navItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => onSectionChange(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all",
                                        activeSection === item.id
                                            ? "bg-neon-green/10 text-neon-green border border-neon-green/20"
                                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                                    )}
                                >
                                    {item.icon}
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </nav>
                </div>

                {/* Content Area */}
                <main className="flex-1 min-w-0">
                    {/* Mobile: Mostrar título de sección activa */}
                    <div className="lg:hidden mb-4">
                        <h2 className="text-lg font-semibold">{activeLabel}</h2>
                    </div>
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
