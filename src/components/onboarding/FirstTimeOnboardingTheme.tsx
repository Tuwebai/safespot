import { useState, useEffect } from 'react'
import { Check, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTheme, Theme, AccentColor } from '@/contexts/ThemeContext'
import { useProfileQuery } from '@/hooks/queries'

// Theme Configuration Data
const THEMES: { id: Theme; name: string; description: string; color: string }[] = [
    { id: 'neon', name: 'Neón Dark', description: 'Oscuro con brillos intensos', color: '#00ff88' },
    { id: 'pastel', name: 'Soft Pastel', description: 'Claro y agradable visualmente', color: '#a855f7' },
    { id: 'minimal', name: 'High Contrast', description: 'Blanco y negro esencial', color: '#000000' },
    { id: 'default', name: 'Clásico', description: 'La experiencia original', color: '#3b82f6' },
]

const ACCENTS: { id: AccentColor; color: string; label: string }[] = [
    { id: 'green', color: '#22c55e', label: 'Verde' },
    { id: 'violet', color: '#8b5cf6', label: 'Violeta' },
    { id: 'cyan', color: '#06b6d4', label: 'Cyan' },
    { id: 'orange', color: '#f97316', label: 'Naranja' },
    { id: 'red', color: '#ef4444', label: 'Rojo' },
    { id: 'yellow', color: '#eab308', label: 'Amarillo' },
]

export function FirstTimeOnboardingTheme() {
    const {
        theme, accentColor, setTheme, setAccentColor, savePreferences, isLoaded,
        isCustomizerOpen, closeCustomizer
    } = useTheme()
    const { isLoading } = useProfileQuery()

    // Internal state for the "First Time" flow
    const [isFirstTimeOpen, setIsFirstTimeOpen] = useState(false)
    const [isVisible, setIsVisible] = useState(false)
    const [isPreviewMode, setIsPreviewMode] = useState(false)

    // 1. Check for First Time Onboarding
    useEffect(() => {
        if (isLoading || !isLoaded) return

        const hasCompletedOnboarding = localStorage.getItem('safespot_onboarding_completed')
        if (!hasCompletedOnboarding && !isCustomizerOpen) {
            setIsFirstTimeOpen(true)
            setTimeout(() => setIsVisible(true), 100)
        }
    }, [isLoading, isLoaded])

    // 2. Sync with Context (Manual Trigger)
    useEffect(() => {
        if (isCustomizerOpen) {
            setIsFirstTimeOpen(false) // Override first time modal if active
            setIsPreviewMode(true)    // Jump straight to preview
        }
    }, [isCustomizerOpen])

    const handleConfirm = async () => {
        await savePreferences();

        // If it was first time flow, mark as done
        if (isFirstTimeOpen) {
            localStorage.setItem('safespot_onboarding_completed', 'true')
            setIsVisible(false)
            setTimeout(() => setIsFirstTimeOpen(false), 300)
        }

        // If it was manual flow
        if (isCustomizerOpen) {
            closeCustomizer()
            setIsPreviewMode(false)
        }
    }

    const handleManualClose = () => {
        if (isCustomizerOpen) {
            closeCustomizer()
            setIsPreviewMode(false)
        }
    }

    // Determine what to render
    const showBottomBar = isPreviewMode || (isCustomizerOpen && !isFirstTimeOpen)
    const showFullModal = isFirstTimeOpen && !isPreviewMode

    if (!showBottomBar && !showFullModal) return null

    // -- BOTTOM BAR (PREVIEW MODE) --
    if (showBottomBar) {
        return (
            <div className="fixed inset-x-0 bottom-6 z-[100] flex justify-center px-4 animate-in slide-in-from-bottom-10 fade-in duration-300 pointer-events-none">
                <div className="bg-card border border-border shadow-2xl p-4 rounded-2xl flex flex-col md:flex-row items-center gap-6 max-w-5xl w-full pointer-events-auto">

                    <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
                        <div className="flex flex-wrap justify-center gap-2">
                            {THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id)}
                                    className={cn(
                                        "px-3 py-1.5 rounded-lg border text-xs font-medium transition-all",
                                        theme === t.id
                                            ? "border-primary bg-primary/10 text-primary"
                                            : "border-border hover:bg-muted text-foreground"
                                    )}
                                >
                                    {t.name}
                                </button>
                            ))}
                        </div>
                        <div className="w-px h-8 bg-border/50 mx-2 hidden md:block" />
                        <div className="h-px w-full bg-border/50 my-2 md:hidden" />

                        <div className="flex flex-wrap justify-center gap-3">
                            {ACCENTS.map((acc) => (
                                <button
                                    key={acc.id}
                                    onClick={() => setAccentColor(acc.id)}
                                    className={cn(
                                        "h-8 w-8 rounded-full transition-all flex items-center justify-center",
                                        accentColor === acc.id
                                            ? "ring-2 ring-offset-2 ring-foreground scale-110"
                                            : "opacity-70 hover:opacity-100 hover:scale-105"
                                    )}
                                    style={{ backgroundColor: acc.color }}
                                    title={acc.label}
                                >
                                    {accentColor === acc.id && <Check className="text-white drop-shadow-sm w-4 h-4" strokeWidth={3} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 ml-auto w-full md:w-auto justify-center md:justify-end border-t md:border-t-0 border-border/50 pt-3 md:pt-0 mt-2 md:mt-0">
                        {isFirstTimeOpen && (
                            <Button variant="ghost" size="sm" onClick={() => setIsPreviewMode(false)}>
                                Expandir
                            </Button>
                        )}
                        {!isFirstTimeOpen && (
                            <Button variant="ghost" size="sm" onClick={handleManualClose} className="text-foreground hover:bg-muted">
                                Cancelar
                            </Button>
                        )}
                        <Button size="sm" onClick={handleConfirm} className="glow-effect font-bold">
                            Guardar <Check className="ml-2 w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </div>
        )
    }

    // -- FULL MODAL --
    return (
        <div
            className={cn(
                "fixed inset-0 z-[100] bg-zinc-950 flex items-center justify-center p-4 transition-opacity duration-300",
                isVisible && showFullModal ? "opacity-100" : "opacity-0"
            )}
        >
            <div className={cn(
                "w-full max-w-4xl grid md:grid-cols-2 gap-8 items-center transition-all duration-500 transform",
                isVisible && showFullModal ? "translate-y-0 scale-100" : "translate-y-10 scale-95"
            )}>

                {/* Left: Preview / Illustration */}
                <div className="hidden md:flex flex-col justify-center h-full space-y-8 p-8 relative overflow-hidden rounded-3xl border border-border/50 bg-card/30">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none" />

                    <div className="relative space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                <Sparkles size={24} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-bold">SafeSpot</h3>
                                <p className="text-muted-foreground">Tu ciudad, más segura.</p>
                            </div>
                        </div>

                        {/* Dummy Card Preview */}
                        <div className="p-4 rounded-xl border border-border bg-card shadow-lg card-glow">
                            {/* ... card content same as before ... */}
                            <div className="flex justify-between items-center mb-2">
                                <div className="h-4 w-24 bg-foreground/20 rounded animate-pulse" />
                                <div className="h-6 w-16 bg-primary/20 rounded-full" />
                            </div>
                            <div className="h-3 w-3/4 bg-foreground/10 rounded mb-2" />
                            <div className="h-3 w-1/2 bg-foreground/10 rounded" />
                            <div className="mt-4 flex gap-2">
                                <Button size="sm" className="w-full">
                                    Ver Detalles
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="text-center">
                        <Button variant="ghost" onClick={() => setIsPreviewMode(true)}>
                            Ver en mi pantalla real &rarr;
                        </Button>
                    </div>
                </div>

                {/* Right: Controls */}
                <div className="space-y-8 text-white">
                    <div className="space-y-2">
                        <h1 className="text-4xl font-bold tracking-tight">
                            Hazlo tuyo.
                        </h1>
                        <p className="text-lg text-zinc-400">
                            Personaliza la experiencia. <button onClick={() => setIsPreviewMode(true)} className="text-primary hover:underline">Activa la vista previa</button> para ver cómo queda en tu app.
                        </p>
                    </div>


                    {/* Theme Selection */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium uppercase tracking-wider text-zinc-500">Tema Principal</label>
                        <div className="grid grid-cols-2 gap-3">
                            {THEMES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setTheme(t.id)}
                                    className={cn(
                                        "relative p-4 rounded-xl border-2 text-left transition-all duration-200 outline-none",
                                        theme === t.id
                                            ? "border-primary bg-primary/5 shadow-[0_0_20px_rgba(0,0,0,0.1)]"
                                            : "border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900/50"
                                    )}
                                >
                                    {theme === t.id && (
                                        <div className="absolute top-2 right-2 text-primary">
                                            <Check size={16} strokeWidth={3} />
                                        </div>
                                    )}
                                    <div className="font-semibold text-zinc-200">{t.name}</div>
                                    <div className="text-xs text-zinc-500 mt-1">{t.description}</div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Accent Selection */}
                    <div className="space-y-4">
                        <label className="text-sm font-medium uppercase tracking-wider text-zinc-500">Color de Acento</label>
                        <div className="flex flex-wrap gap-3">
                            {ACCENTS.map((acc) => (
                                <button
                                    key={acc.id}
                                    onClick={() => setAccentColor(acc.id)}
                                    className={cn(
                                        "h-12 w-12 rounded-full flex items-center justify-center transition-all duration-200",
                                        accentColor === acc.id
                                            ? "ring-4 ring-offset-4 ring-offset-zinc-950 ring-white scale-110"
                                            : "hover:scale-110 opacity-80 hover:opacity-100"
                                    )}
                                    style={{ backgroundColor: acc.color }}
                                    title={acc.label}
                                >
                                    {accentColor === acc.id && <Check className="text-white drop-shadow-md" size={20} strokeWidth={3} />}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="pt-8">
                        <Button
                            size="lg"
                            className="w-full text-lg h-14 font-bold shadow-2xl shadow-primary/20 hover:shadow-primary/40 transition-all text-black"
                            onClick={handleConfirm}
                        >
                            Comenzar Experiencia <ArrowRight className="ml-2" />
                        </Button>
                    </div>

                </div>
            </div>
        </div>
    )
}
