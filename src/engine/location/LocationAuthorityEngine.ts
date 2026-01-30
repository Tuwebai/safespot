/**
 * Location Authority Engine (Motor 5)
 * 
 * ROLE: Principal Software Architect
 * RESPONSIBILITY: Single Source of Truth for user location state.
 * 
 * This engine manages the Finite State Machine (FSM) of geolocation,
 * providing a centralized authority that can be consumed by:
 * - Map components
 * - Push notification services
 * - Background tasks
 * - Any component needing location awareness
 * 
 * RULES:
 * - NO UI rendering
 * - NO blocking
 * - NO UX decisions
 * - NO forced permissions
 * - Emits states, consumers decide what to show
 */

// ===========================================
// FSM STATES
// ===========================================

export enum LocationState {
    UNKNOWN = 'UNKNOWN',                         // Initial state
    PERMISSION_REQUIRED = 'PERMISSION_REQUIRED', // Need to ask user
    RESOLVING = 'RESOLVING',                     // Actively resolving
    RESOLVED = 'RESOLVED',                       // Location available
    DENIED = 'DENIED',                           // User denied permission
    UNAVAILABLE = 'UNAVAILABLE'                  // GPS/Network unavailable
}

// ===========================================
// TYPES
// ===========================================

export interface LocationPosition {
    lat: number
    lng: number
    accuracy?: number
    source: 'gps' | 'zone' | 'settings' | 'initial_focus'
}

export interface LocationFallbacks {
    initialFocus?: { lat: number; lng: number } | null
    zones?: Array<{ type: string; lat: number; lng: number }> | null
    lastKnown?: { lat: number; lng: number } | null
}

type StateChangeListener = (state: LocationState, position: LocationPosition | null) => void

// ===========================================
// LOCATION AUTHORITY ENGINE
// ===========================================

class LocationAuthorityEngine {
    private static instance: LocationAuthorityEngine

    // FSM State
    private state: LocationState = LocationState.UNKNOWN
    private position: LocationPosition | null = null
    private statusMessage: string = ''
    private lastResolvedAt: number | null = null

    // Observers
    private listeners: Set<StateChangeListener> = new Set()

    // Resolution control
    private isResolving: boolean = false
    private abortController: AbortController | null = null

    // Cached fallbacks (set by consumers)
    private fallbacks: LocationFallbacks = {}

    private constructor() {
        console.log('[Location] Engine initialized')
    }

    // ===========================================
    // SINGLETON
    // ===========================================

    public static getInstance(): LocationAuthorityEngine {
        if (!LocationAuthorityEngine.instance) {
            LocationAuthorityEngine.instance = new LocationAuthorityEngine()
        }
        return LocationAuthorityEngine.instance
    }

    // ===========================================
    // PUBLIC API - STATE
    // ===========================================

    public getState(): LocationState {
        return this.state
    }

    public getPosition(): LocationPosition | null {
        return this.position
    }

    public getStatusMessage(): string {
        return this.statusMessage
    }

    public getLastResolvedAt(): number | null {
        return this.lastResolvedAt
    }

    public isResolved(): boolean {
        return this.state === LocationState.RESOLVED && this.position !== null
    }

    public isDenied(): boolean {
        return this.state === LocationState.DENIED
    }

    public isUnavailable(): boolean {
        return this.state === LocationState.UNAVAILABLE
    }

    // ===========================================
    // PUBLIC API - ACTIONS (INTENTS)
    // ===========================================

    /**
     * Set fallback data for resolution pipeline.
     * ✅ FIX: If we're resolving (waiting for GPS) or failed, and we now have fallbacks,
     * resolve IMMEDIATELY from cached data instead of waiting for GPS timeout.
     */
    public setFallbacks(fallbacks: LocationFallbacks): void {
        // Merge new fallbacks
        this.fallbacks = { ...this.fallbacks, ...fallbacks }

        console.log('[Location] setFallbacks called', {
            state: this.state,
            hasLastKnown: !!this.fallbacks.lastKnown,
            hasZones: !!(this.fallbacks.zones && this.fallbacks.zones.length > 0),
            hasInitialFocus: !!this.fallbacks.initialFocus
        })

        // ✅ FIX: If resolving (GPS pending) or failed, and we have fallbacks → resolve NOW
        const shouldAutoResolve =
            (this.state === LocationState.RESOLVING || this.state === LocationState.UNAVAILABLE) &&
            this.hasFallbacks()

        if (shouldAutoResolve) {
            console.log('[Location] Have fallbacks + state is RESOLVING/UNAVAILABLE → resolving immediately!')
            this.abort() // Cancel any pending GPS request
            this.resolveFromFallbacksOnly()
        }
    }

    /**
     * Check if we have any valid fallbacks
     */
    private hasFallbacks(): boolean {
        return !!(
            this.fallbacks.initialFocus ||
            (this.fallbacks.zones && this.fallbacks.zones.length > 0) ||
            this.fallbacks.lastKnown
        )
    }

    /**
     * Resolve using only fallbacks (no GPS attempt)
     */
    private resolveFromFallbacksOnly(): void {
        // Priority: initialFocus > zones > lastKnown
        if (this.fallbacks.initialFocus) {
            const { lat, lng } = this.fallbacks.initialFocus
            if (this.isValidCoord(lat, lng)) {
                this.setState(LocationState.RESOLVED, { lat, lng, source: 'initial_focus' })
                return
            }
        }

        if (this.fallbacks.zones && this.fallbacks.zones.length > 0) {
            const priorityOrder = ['home', 'work', 'frequent']
            for (const zoneType of priorityOrder) {
                const zone = this.fallbacks.zones.find(z => z.type === zoneType)
                if (zone && this.isValidCoord(zone.lat, zone.lng)) {
                    this.setState(LocationState.RESOLVED, { lat: zone.lat, lng: zone.lng, source: 'zone' })
                    return
                }
            }
        }

        if (this.fallbacks.lastKnown) {
            const { lat, lng } = this.fallbacks.lastKnown
            if (this.isValidCoord(lat, lng)) {
                this.setState(LocationState.RESOLVED, { lat, lng, source: 'settings' })
                return
            }
        }

        // No valid fallbacks found
        console.log('[Location] No valid fallbacks to resolve from')
    }

    /**
     * Request location resolution
     * @param mode 'auto' for initial load, 'manual' for user-triggered retry
     */
    public async requestLocation(mode: 'auto' | 'manual' = 'auto'): Promise<void> {
        // Prevent concurrent resolutions
        if (this.isResolving) {
            console.log('[Location] Already resolving, ignoring request')
            return
        }

        this.isResolving = true
        this.abortController = new AbortController()

        try {
            await this.resolveLocation(mode)
        } finally {
            this.isResolving = false
            this.abortController = null
        }
    }

    /**
     * Retry location resolution (user-triggered)
     */
    public async retry(): Promise<void> {
        return this.requestLocation('manual')
    }

    /**
     * Abort current resolution
     */
    public abort(): void {
        if (this.abortController) {
            this.abortController.abort()
            this.isResolving = false
            console.log('[Location] Resolution aborted')
        }
    }

    // ===========================================
    // PUBLIC API - OBSERVABILITY
    // ===========================================

    public subscribe(listener: StateChangeListener): () => void {
        this.listeners.add(listener)
        // Immediately notify with current state
        listener(this.state, this.position)
        return () => this.listeners.delete(listener)
    }

    // ===========================================
    // PRIVATE - FSM TRANSITIONS
    // ===========================================

    private setState(
        newState: LocationState,
        position: LocationPosition | null = null,
        statusMessage: string = ''
    ): void {
        const previousState = this.state
        if (previousState === newState && this.position === position) return

        // ✅ LOGGING TRANSICIONES (Recomendación Staff)
        console.log(`[Location] STATE_CHANGE: ${previousState} → ${newState}`,
            position ? `(${position.lat.toFixed(4)}, ${position.lng.toFixed(4)} via ${position.source})` : '')

        this.state = newState
        this.position = position
        this.statusMessage = statusMessage

        if (newState === LocationState.RESOLVED && position) {
            this.lastResolvedAt = Date.now()
        }

        this.notify()
    }

    private notify(): void {
        this.listeners.forEach(listener => {
            try {
                listener(this.state, this.position)
            } catch (e) {
                console.error('[Location] Listener error:', e)
            }
        })
    }

    // ===========================================
    // PRIVATE - RESOLUTION PIPELINE
    // ===========================================

    private async resolveLocation(mode: 'auto' | 'manual'): Promise<void> {
        this.setState(
            LocationState.RESOLVING,
            null,
            mode === 'manual' ? 'Reintentando ubicarte...' : 'Iniciando geolocalización...'
        )

        // 1. Initial Focus (Deep Link) → HIGHEST PRIORITY (Instant)
        if (this.fallbacks.initialFocus) {
            const { lat, lng } = this.fallbacks.initialFocus
            if (this.isValidCoord(lat, lng)) {
                this.setState(LocationState.RESOLVED, { lat, lng, source: 'initial_focus' })
                return
            }
        }

        // 2. Priority Zones (Home > Work > Frequent) → CACHE
        if (this.fallbacks.zones && this.fallbacks.zones.length > 0) {
            const priorityOrder = ['home', 'work', 'frequent']
            for (const zoneType of priorityOrder) {
                const zone = this.fallbacks.zones.find(z => z.type === zoneType)
                if (zone && this.isValidCoord(zone.lat, zone.lng)) {
                    this.setState(LocationState.RESOLVED, { lat: zone.lat, lng: zone.lng, source: 'zone' })
                    return
                }
            }
        }

        // 3. Last Known Location (Settings) → CACHE
        if (this.fallbacks.lastKnown) {
            const { lat, lng } = this.fallbacks.lastKnown
            if (this.isValidCoord(lat, lng)) {
                this.setState(LocationState.RESOLVED, { lat, lng, source: 'settings' })
                return
            }
        }

        // 4. BROWSER GEOLOCATION (The Tricky Part)
        if (!('geolocation' in navigator)) {
            this.setState(LocationState.UNAVAILABLE, null, 'Tu navegador no soporta geolocalización.')
            return
        }

        // 4.1 Check Permissions API first (fail fast)
        try {
            if (navigator.permissions?.query) {
                const result = await navigator.permissions.query({ name: 'geolocation' })
                if (result.state === 'denied') {
                    this.setState(LocationState.DENIED)
                    return
                }
                if (result.state === 'prompt') {
                    // User hasn't decided yet - we'll proceed to ask
                    this.setState(LocationState.PERMISSION_REQUIRED, null, 'Se requiere permiso de ubicación')
                }
            }
        } catch {
            // Ignore permission query errors (some browsers don't support it)
        }

        this.setState(LocationState.RESOLVING, null, 'Solicitando ubicación precisa...')

        // 4.2 Strategy: High Accuracy (Short Timeout) → Relaxed (Long Timeout)
        try {
            // ATTEMPT 1: High Accuracy, 6s timeout
            const pos = await this.getBrowserPosition({
                enableHighAccuracy: true,
                timeout: 6000,
                maximumAge: 10000
            })

            this.setState(LocationState.RESOLVED, {
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                accuracy: pos.coords.accuracy,
                source: 'gps'
            })

        } catch (err: unknown) {
            const error = err as GeolocationPositionError

            if (error.code === 1) { // PERMISSION_DENIED
                this.setState(LocationState.DENIED)
                return
            }

            if (error.code === 2) { // POSITION_UNAVAILABLE
                this.setState(LocationState.UNAVAILABLE, null, 'No pudimos determinar tu ubicación. Verifica tu GPS o red.')
                return
            }

            // TIMEOUT (Code 3) → RETRY with relaxed constraints
            if (error.code === 3) {
                console.log('[Location] High accuracy timeout, retrying with relaxed constraints...')
                this.setState(LocationState.RESOLVING, null, 'Afinando ubicación (modo extendido)...')

                try {
                    // ATTEMPT 2: Low Accuracy, 15s timeout
                    const posRetry = await this.getBrowserPosition({
                        enableHighAccuracy: false,
                        timeout: 15000,
                        maximumAge: 60000
                    })

                    this.setState(LocationState.RESOLVED, {
                        lat: posRetry.coords.latitude,
                        lng: posRetry.coords.longitude,
                        accuracy: posRetry.coords.accuracy,
                        source: 'gps'
                    })

                } catch (retryErr: unknown) {
                    const retryError = retryErr as GeolocationPositionError

                    if (retryError.code === 1) {
                        this.setState(LocationState.DENIED)
                    } else {
                        this.setState(
                            LocationState.UNAVAILABLE,
                            null,
                            'El servicio de ubicación tardó demasiado. Intenta de nuevo.'
                        )
                    }
                }
            } else {
                // Unknown error
                this.setState(LocationState.UNAVAILABLE)
            }
        }
    }

    // ===========================================
    // PRIVATE - HELPERS
    // ===========================================

    private getBrowserPosition(options: PositionOptions): Promise<GeolocationPosition> {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, options)
        })
    }

    private isValidCoord(lat: number | undefined, lng: number | undefined): boolean {
        return (
            typeof lat === 'number' &&
            typeof lng === 'number' &&
            !isNaN(lat) &&
            !isNaN(lng) &&
            lat !== 0 &&
            lng !== 0
        )
    }
}

// ===========================================
// SINGLETON EXPORT
// ===========================================

export const locationAuthority = LocationAuthorityEngine.getInstance()

// ✅ MOTOR 5 Bridge: Expose to window for debugging
if (typeof window !== 'undefined') {
    (window as any).__safespot_location_authority = locationAuthority
}
