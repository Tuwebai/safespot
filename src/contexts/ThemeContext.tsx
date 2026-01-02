import React, { createContext, useContext, useEffect, useState } from 'react'
import { usersApi } from '@/lib/api'

export type Theme = 'neon' | 'pastel' | 'minimal' | 'default'
export type AccentColor = 'green' | 'violet' | 'cyan' | 'orange' | 'red' | 'yellow'

interface ThemeContextType {
    theme: Theme
    accentColor: AccentColor
    setTheme: (theme: Theme) => void
    setAccentColor: (color: AccentColor) => void
    savePreferences: () => Promise<void>
    isLoaded: boolean
    isCustomizerOpen: boolean
    openCustomizer: () => void
    closeCustomizer: () => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    // Initialize with defaults or localStorage
    const [theme, setThemeState] = useState<Theme>(() => {
        return (localStorage.getItem('safespot_theme') as Theme) || 'default'
    })

    const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
        return (localStorage.getItem('safespot_accent') as AccentColor) || 'green'
    })

    const [isLoaded, setIsLoaded] = useState(false)
    const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)

    // Apply to DOM immediately when state changes
    useEffect(() => {
        const root = window.document.documentElement

        // Apply Theme
        if (theme === 'default') {
            root.removeAttribute('data-theme')
        } else {
            root.setAttribute('data-theme', theme)
        }

        // Apply Accent
        if (accentColor === 'green') {
            root.removeAttribute('data-accent-color')
        } else {
            root.setAttribute('data-accent-color', accentColor)
        }

        // Save simple persistence check
        localStorage.setItem('safespot_theme', theme)
        localStorage.setItem('safespot_accent', accentColor)

    }, [theme, accentColor])

    // Sync with Backend on Mount
    useEffect(() => {
        async function syncWithBackend() {
            try {
                const profile = await usersApi.getProfile()
                if (profile) {
                    if (profile.theme && isValidTheme(profile.theme)) {
                        setThemeState(profile.theme as Theme)
                    }
                    if (profile.accent_color && isValidAccent(profile.accent_color)) {
                        setAccentColorState(profile.accent_color as AccentColor)
                    }
                }
            } catch (error) {
                console.error("Failed to sync theme preferences", error)
            } finally {
                setIsLoaded(true)
            }
        }

        syncWithBackend()
    }, [])

    const setTheme = (t: Theme) => setThemeState(t)
    const setAccentColor = (c: AccentColor) => setAccentColorState(c)

    const savePreferences = async () => {
        // Persist to backend
        try {
            await usersApi.updateProfile({
                theme,
                accent_color: accentColor
            })
        } catch (error) {
            console.error("Failed to save theme preferences", error)
        }
    }

    const value = {
        theme,
        accentColor,
        setTheme,
        setAccentColor,
        savePreferences,
        isLoaded,
        isCustomizerOpen,
        openCustomizer: () => setIsCustomizerOpen(true),
        closeCustomizer: () => setIsCustomizerOpen(false)
    }

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    )
}

export function useTheme() {
    const context = useContext(ThemeContext)
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider')
    }
    return context
}

// Helpers
function isValidTheme(t: string): boolean {
    return ['neon', 'pastel', 'minimal', 'default'].includes(t)
}

function isValidAccent(c: string): boolean {
    return ['green', 'violet', 'cyan', 'orange', 'red', 'yellow'].includes(c)
}
