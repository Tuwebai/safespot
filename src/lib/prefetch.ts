/**
 * Prefetch utilities for improving navigation performance
 * 
 * This module provides:
 * 1. In-memory cache for prefetched data
 * 2. Prefetch functions for reports and other entities
 * 3. PrefetchLink component for automatic prefetching on hover
 */

import { reportsApi, type Report } from '@/lib/api'

// ============================================
// PREFETCH CACHE
// ============================================

interface CacheEntry<T> {
    data: T
    timestamp: number
    promise?: Promise<T>
}

// Simple in-memory cache with 60-second TTL
const CACHE_TTL = 60 * 1000 // 60 seconds
const reportCache = new Map<string, CacheEntry<Report>>()

// Track in-flight requests to avoid duplicates
const pendingRequests = new Map<string, Promise<Report | null>>()

/**
 * Check if a cached entry is still valid
 */
function isCacheValid<T>(entry: CacheEntry<T> | undefined): boolean {
    if (!entry) return false
    return Date.now() - entry.timestamp < CACHE_TTL
}

/**
 * Get a report from cache if valid
 */
export function getCachedReport(id: string): Report | null {
    const entry = reportCache.get(id)
    return isCacheValid(entry) ? entry!.data : null
}

/**
 * Prefetch a report by ID
 * - Returns immediately if already cached
 * - Deduplicates concurrent requests to the same ID
 * - Stores result in cache for future use
 */
export async function prefetchReport(id: string): Promise<Report | null> {
    // 1. Check cache first
    const cached = getCachedReport(id)
    if (cached) {
        return cached
    }

    // 2. Check if request is already in flight
    const pending = pendingRequests.get(id)
    if (pending) {
        return pending
    }

    // 3. Start new request
    const promise = reportsApi.getById(id)
        .then(report => {
            reportCache.set(id, {
                data: report,
                timestamp: Date.now()
            })
            return report
        })
        .catch((error: any) => {
            // Enterprise: Suppress 404 "Not Found" as valid state (e.g. optimistic or deleted)
            const isNotFound =
                error?.status === 404 ||
                error?.statusCode === 404 ||
                error?.response?.status === 404 ||
                (typeof error?.message === 'string' && error.message.includes('404'));

            if (!isNotFound) {
                // Only log unexpected errors
                if (import.meta.env.DEV) {
                    console.debug(`[prefetch] Skipped report ${id}:`, error?.message || error)
                }
            }
            return null
        })
        .finally(() => {
            pendingRequests.delete(id)
        })

    pendingRequests.set(id, promise)
    return promise
}

/**
 * Invalidate cache for a specific report
 * Call this after mutations (update, delete)
 */
export function invalidateReportCache(id: string): void {
    reportCache.delete(id)
}

/**
 * Clear all prefetch caches
 */
export function clearPrefetchCache(): void {
    reportCache.clear()
    pendingRequests.clear()
}

// ============================================
// ROUTE PREFETCHING
// ============================================

// Track which route chunks have been prefetched
const prefetchedRoutes = new Set<string>()

/**
 * Prefetch a route's JavaScript chunk
 * This loads the code without executing it
 */
export function prefetchRouteChunk(routeName: string): void {
    if (prefetchedRoutes.has(routeName)) return
    prefetchedRoutes.add(routeName)

    // Dynamic import to trigger Vite's code-splitting
    switch (routeName) {
        case 'DetalleReporte':
            import('@/pages/DetalleReporte').catch(() => { })
            break
        case 'Gamificacion':
            import('@/pages/Gamificacion').catch(() => { })
            break
        case 'Perfil':
            import('@/pages/Perfil').catch(() => { })
            break
        case 'CrearReporte':
            import('@/pages/CrearReporte').catch(() => { })
            break
        case 'Reportes':
            import('@/pages/Reportes').catch(() => { })
            break
        case 'Explorar':
            import('@/pages/Explorar').catch(() => { })
            break
        case 'MisFavoritos':
            import('@/pages/MisFavoritos').catch(() => { })
            break
    }
}
