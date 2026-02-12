/**
 * PreferencesSection - Enterprise Grade
 * 
 * Gestión de preferencias de interfaz del administrador:
 * - Persistencia en localStorage
 * - Sincronización en tiempo real
 * - Accesibilidad completa
 * - Estados de carga optimistas
 */

import { useState, useEffect, useCallback } from 'react'
import { Bell, Volume2, Layout, Monitor, Moon, Sun, Laptop } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { useAdminTheme, type AdminColorScheme } from '@/admin/contexts/AdminThemeContext'

// Local storage keys - Centralized configuration
const STORAGE_KEYS = {
    notifications: 'safespot_admin_pref_notifications',
    sounds: 'safespot_admin_pref_sounds',
    compactMode: 'safespot_admin_pref_compact',
    sidebarCollapsed: 'safespot_admin_pref_sidebar',
} as const

interface AdminPreferences {
    notifications: boolean
    sounds: boolean
    compactMode: boolean
    sidebarCollapsed: boolean
}

const DEFAULT_PREFERENCES: AdminPreferences = {
    notifications: true,
    sounds: true,
    compactMode: false,
    sidebarCollapsed: false,
}

/**
 * Load preferences from localStorage with fallback to defaults
 */
function loadPreferences(): AdminPreferences {
    if (typeof window === 'undefined') return DEFAULT_PREFERENCES
    
    try {
        return {
            notifications: localStorage.getItem(STORAGE_KEYS.notifications) !== 'false',
            sounds: localStorage.getItem(STORAGE_KEYS.sounds) !== 'false',
            compactMode: localStorage.getItem(STORAGE_KEYS.compactMode) === 'true',
            sidebarCollapsed: localStorage.getItem(STORAGE_KEYS.sidebarCollapsed) === 'true',
        }
    } catch {
        return DEFAULT_PREFERENCES
    }
}

/**
 * Save preference to localStorage
 */
function savePreference<K extends keyof AdminPreferences>(
    key: K, 
    value: AdminPreferences[K]
): void {
    try {
        localStorage.setItem(STORAGE_KEYS[key], String(value))
    } catch {
        // Ignore storage errors (e.g., private mode)
    }
}

export function PreferencesSection() {
    // Theme from admin context (real-time)
    const { colorScheme, resolvedColorScheme, setColorScheme } = useAdminTheme()
    
    // Other preferences (local state)
    const [prefs, setPrefs] = useState<AdminPreferences>(DEFAULT_PREFERENCES)
    const [isLoaded, setIsLoaded] = useState(false)

    // Load preferences on mount
    useEffect(() => {
        setPrefs(loadPreferences())
        setIsLoaded(true)
    }, [])

    // Toggle handler with persistence
    const togglePref = useCallback(<K extends keyof AdminPreferences>(
        key: K,
        value: AdminPreferences[K]
    ) => {
        setPrefs(prev => ({ ...prev, [key]: value }))
        savePreference(key, value)
    }, [])

    // Handle theme change
    const handleThemeChange = useCallback((newTheme: AdminColorScheme) => {
        setColorScheme(newTheme)
    }, [setColorScheme])

    // Preference items configuration
    const preferenceItems = [
        {
            id: 'notifications' as const,
            icon: Bell,
            title: 'Notificaciones de Moderación',
            description: 'Recibir alertas in-app sobre nuevos reportes críticos y acciones requeridas.',
        },
        {
            id: 'sounds' as const,
            icon: Volume2,
            title: 'Sonidos de Notificación',
            description: 'Reproducir sonidos cuando lleguen alertas importantes o mensajes.',
        },
        {
            id: 'compactMode' as const,
            icon: Layout,
            title: 'Modo Compacto',
            description: 'Reducir espaciado en tablas y listados para mostrar más información.',
        },
    ] as const

    // Theme options
    const themeOptions: { value: AdminColorScheme; label: string; icon: typeof Sun }[] = [
        { value: 'light', label: 'Claro', icon: Sun },
        { value: 'dark', label: 'Oscuro', icon: Moon },
        { value: 'system', label: 'Sistema', icon: Laptop },
    ]

    if (!isLoaded) {
        return (
            <div className="space-y-6 animate-pulse">
                <div className="h-7 w-48 bg-[#1e293b] rounded" />
                <div className="space-y-2">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-20 bg-[#0f172a]/50 rounded-lg" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <h3 className="text-lg font-medium text-white flex items-center gap-2 border-b border-[#1e293b] pb-2">
                <Monitor className="h-5 w-5 text-[#00ff88]" />
                Preferencias de Interfaz
            </h3>

            {/* Toggle Preferences */}
            <div className="grid gap-2 bg-[#0f172a]/50 border border-[#1e293b] rounded-lg overflow-hidden">
                {preferenceItems.map((item, index) => {
                    const Icon = item.icon
                    const isChecked = prefs[item.id]
                    
                    return (
                        <div 
                            key={item.id}
                            className={cn(
                                "p-4 flex items-center justify-between transition-colors",
                                index !== preferenceItems.length - 1 && "border-b border-[#1e293b]/50",
                                "hover:bg-[#1e293b]/30"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "h-10 w-10 rounded-lg flex items-center justify-center transition-colors",
                                    isChecked ? "bg-[#00ff88]/10 text-[#00ff88]" : "bg-[#1e293b] text-slate-400"
                                )}>
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                    <p className="text-white text-sm font-medium">{item.title}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">{item.description}</p>
                                </div>
                            </div>
                            <Switch
                                checked={isChecked}
                                onCheckedChange={(checked) => togglePref(item.id, checked)}
                                aria-label={item.title}
                            />
                        </div>
                    )
                })}
            </div>

            {/* Theme Selector */}
            <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-300">
                    Tema de la Interfaz
                    {resolvedColorScheme !== colorScheme && (
                        <span className="ml-2 text-xs text-slate-500">
                            (Actual: {resolvedColorScheme === 'dark' ? 'Oscuro' : 'Claro'})
                        </span>
                    )}
                </h4>
                <div className="grid grid-cols-3 gap-2">
                    {themeOptions.map(({ value, label, icon: Icon }) => (
                        <button
                            key={value}
                            onClick={() => handleThemeChange(value)}
                            className={cn(
                                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all",
                                colorScheme === value
                                    ? "bg-[#00ff88]/10 border-[#00ff88]/50 text-[#00ff88]"
                                    : "bg-[#0f172a]/50 border-[#1e293b] text-slate-400 hover:border-[#334155]"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span className="text-xs font-medium">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Reset Button */}
            <div className="pt-4 border-t border-[#1e293b]">
                <button
                    onClick={() => {
                        setPrefs(DEFAULT_PREFERENCES)
                        Object.keys(STORAGE_KEYS).forEach(key => {
                            localStorage.removeItem(STORAGE_KEYS[key as keyof typeof STORAGE_KEYS])
                        })
                        // Reset theme to default
                        handleThemeChange('dark')
                    }}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    Restaurar preferencias predeterminadas
                </button>
            </div>
        </div>
    )
}
