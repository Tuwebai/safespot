import { Bike, Car, Smartphone, Laptop, Wallet, Flame, HelpCircle, AlertTriangle, Siren, Eye, type LucideIcon } from 'lucide-react'
import { ALL_CATEGORIES, type Category } from '@/lib/constants'

// Enterprise Icon Configuration Contract
export interface IconConfig {
    icon: LucideIcon
    color: string
    label: string // Explicit accessible label
}

// Single Source of Truth for Map Icons
// Mapped 1:1 to ALL_CATEGORIES from constants.ts
export const CATEGORY_ICONS: Record<Category, IconConfig> = {
    'Celulares': {
        icon: Smartphone,
        color: '#ec4899', // Pink-500 (High Visibility)
        label: 'Robo de Celular'
    },
    'Bicicletas': {
        icon: Bike,
        color: '#ef4444', // Red-500 (Urgent)
        label: 'Robo de Bicicleta'
    },
    'Motos': {
        icon: Flame,
        color: '#f97316', // Orange-500 (Cautious)
        label: 'Robo de Moto'
    },
    'Autos': {
        icon: Car,
        color: '#3b82f6', // Blue-500 (Contrast)
        label: 'Robo de Auto'
    },
    'Laptops': {
        icon: Laptop,
        color: '#8b5cf6', // Violet-500 (Tech)
        label: 'Robo de Laptop'
    },
    'Carteras': {
        icon: Wallet,
        color: '#10b981', // Emerald-500 (Valuables)
        label: 'Robo de Cartera'
    },
    'Robo': {
        icon: AlertTriangle,
        color: '#dc2626', // Red-600 (Urgent)
        label: 'Robo en Curso'
    },
    'Accidente': {
        icon: Siren,
        color: '#ea580c', // Orange-600
        label: 'Accidente de Tránsito'
    },
    'Sospechoso': {
        icon: Eye,
        color: '#ca8a04', // Yellow-600
        label: 'Actividad Sospechosa'
    },
    'Violencia': {
        icon: Flame,
        color: '#7f1d1d', // Red-900
        label: 'Violencia'
    }
}

// Fallback for unexpected data corruption or legacy categories
export const UNKNOWN_ICON: IconConfig = {
    icon: HelpCircle,
    color: '#64748b', // Slate-500 (Neutral)
    label: 'Categoría Desconocida'
}

/**
 * Type Guard to check if a string is a valid Category
 */
export const isValidCategory = (category: string): category is Category => {
    return ALL_CATEGORIES.includes(category as Category)
}

/**
 * Resolver function with runtime safety logging
 */
export const resolveCategoryIcon = (category: string): IconConfig => {
    if (isValidCategory(category)) {
        return CATEGORY_ICONS[category]
    }

    // Enterprise Logging: Log missing categories to help catch data drift
    if (import.meta.env.DEV) {
        console.warn(`[IconRegistry] Unknown category encountered: "${category}". Fallback applied. Check database vs constants.`)
    }

    return UNKNOWN_ICON
}
