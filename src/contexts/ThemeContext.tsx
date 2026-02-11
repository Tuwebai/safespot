import React, { createContext, useContext, useEffect, useState } from 'react'
import { useProfileQuery } from '@/hooks/queries/useProfileQuery'
import { useUpdateProfileMutation } from '@/hooks/mutations/useUpdateProfileMutation'

export type Theme = 'neon' | 'pastel' | 'minimal' | 'default'
export type AccentColor = 'green' | 'violet' | 'cyan' | 'orange' | 'red' | 'yellow'
export type ColorScheme = 'light' | 'dark' | 'system'

interface ThemeContextType {
    theme: Theme
    accentColor: AccentColor
    colorScheme: ColorScheme
    resolvedColorScheme: 'light' | 'dark'
    setTheme: (theme: Theme) => void
    setAccentColor: (color: AccentColor) => void
    setColorScheme: (scheme: ColorScheme) => void
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

    const [colorScheme, setColorSchemeState] = useState<ColorScheme>(() => {
        return (localStorage.getItem('safespot_admin_pref_theme') as ColorScheme) || 'dark'
    })

    const [resolvedColorScheme, setResolvedColorScheme] = useState<'light' | 'dark'>('dark')

    const [isLoaded, setIsLoaded] = useState(false)
    const [isCustomizerOpen, setIsCustomizerOpen] = useState(false)

    // ✅ SAFE MODE: Use hooks instead of direct API imports
    const { data: profile, isLoading: isProfileLoading } = useProfileQuery()
    const updateProfileMutation = useUpdateProfileMutation()

    // Helper to resolve system preference
    const resolveSystemScheme = (): 'light' | 'dark' => {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

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

        // Apply Color Scheme (light/dark)
        const resolved = colorScheme === 'system' ? resolveSystemScheme() : colorScheme
        setResolvedColorScheme(resolved)
        
        root.classList.remove('light', 'dark')
        root.classList.add(resolved)

        // Update meta theme-color for mobile using CSS variables
        const metaThemeColor = document.querySelector('meta[name="theme-color"]')
        if (metaThemeColor) {
            // Get computed background color from root to ensure theme consistency
            const rootStyles = getComputedStyle(root)
            const bgColor = rootStyles.getPropertyValue('--background').trim()
            // Convert HSL to CSS hsl() format for meta tag
            metaThemeColor.setAttribute('content', `hsl(${bgColor})`)
        }

        // Save simple persistence check
        localStorage.setItem('safespot_theme', theme)
        localStorage.setItem('safespot_accent', accentColor)
        localStorage.setItem('safespot_admin_pref_theme', colorScheme)

    }, [theme, accentColor, colorScheme])

    // Listen for system theme changes
    useEffect(() => {
        if (colorScheme !== 'system') return

        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
        const handler = (e: MediaQueryListEvent) => {
            const newScheme = e.matches ? 'dark' : 'light'
            setResolvedColorScheme(newScheme)
            
            const root = window.document.documentElement
            root.classList.remove('light', 'dark')
            root.classList.add(newScheme)
        }

        mediaQuery.addEventListener('change', handler)
        return () => mediaQuery.removeEventListener('change', handler)
    }, [colorScheme])

    // ✅ SAFE MODE: Sync with Backend when profile loads
    useEffect(() => {
        if (!isProfileLoading) {
            if (profile) {
                if (profile.theme && isValidTheme(profile.theme)) {
                    setThemeState(profile.theme as Theme)
                }
                if (profile.accent_color && isValidAccent(profile.accent_color)) {
                    setAccentColorState(profile.accent_color as AccentColor)
                }
            }
            setIsLoaded(true)
        }
    }, [profile, isProfileLoading])

    const setTheme = (t: Theme) => setThemeState(t)
    const setAccentColor = (c: AccentColor) => setAccentColorState(c)
    const setColorScheme = (s: ColorScheme) => setColorSchemeState(s)

    const savePreferences = async () => {
        // Persist to backend via mutation hook
        updateProfileMutation.mutate({
            theme,
            accent_color: accentColor
        })
    }

    const value = {
        theme,
        accentColor,
        colorScheme,
        resolvedColorScheme,
        setTheme,
        setAccentColor,
        setColorScheme,
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
