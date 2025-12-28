/**
 * Loading fallback for lazy-loaded routes
 * Shows a centered spinner while the route component loads
 */

export function RouteLoadingFallback() {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                {/* Spinner */}
                <div className="h-12 w-12 animate-spin rounded-full border-4 border-dark-border border-t-neon-green" />

                {/* Loading text */}
                <p className="text-sm text-muted-foreground">Cargando...</p>
            </div>
        </div>
    )
}
