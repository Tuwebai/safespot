/**
 * Admin Theme Context - Versión simplificada para panel de admin
 * No depende del perfil de usuario, solo usa localStorage
 */
import React, { createContext, useContext, useEffect, useState } from 'react'

export type AdminColorScheme = 'light' | 'dark' | 'system'

interface AdminThemeContextType {
    colorScheme: AdminColorScheme
    resolvedColorScheme: 'light' | 'dark'
    setColorScheme: (scheme: AdminColorScheme) => void
    isLoaded: boolean
}

const AdminThemeContext = createContext<AdminThemeContextType | undefined>(undefined)

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
    const [colorScheme, setColorSchemeState] = useState<AdminColorScheme>(() => {
        return (localStorage.getItem('safespot_admin_color_scheme') as AdminColorScheme) || 'dark'
    })

    const [resolvedColorScheme, setResolvedColorScheme] = useState<'light' | 'dark'>('dark')
    const [isLoaded, setIsLoaded] = useState(false)

    // Resolve system preference
    const resolveSystemScheme = (): 'light' | 'dark' => {
        if (typeof window === 'undefined') return 'dark'
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }

    // Apply theme immediately
    useEffect(() => {
        const root = window.document.documentElement
        const resolved = colorScheme === 'system' ? resolveSystemScheme() : colorScheme
        
        setResolvedColorScheme(resolved)
        root.classList.remove('light', 'dark')
        root.classList.add(resolved)

        localStorage.setItem('safespot_admin_color_scheme', colorScheme)
        setIsLoaded(true)
    }, [colorScheme])

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

    const setColorScheme = (scheme: AdminColorScheme) => {
        setColorSchemeState(scheme)
    }

    return (
        <AdminThemeContext.Provider value={{
            colorScheme,
            resolvedColorScheme,
            setColorScheme,
            isLoaded
        }}>
            {children}
        </AdminThemeContext.Provider>
    )
}

export function useAdminTheme() {
    const context = useContext(AdminThemeContext)
    if (context === undefined) {
        throw new Error('useAdminTheme must be used within an AdminThemeProvider')
    }
    return context
}
