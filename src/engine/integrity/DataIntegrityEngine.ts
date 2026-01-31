/**
 * Data Integrity & Healing Engine (Motor 4)
 * 
 * ROLE: SUPERVISOR de integridad de datos.
 * RESPONSIBILITY: Observar, diagnosticar y recomendar acciones de healing.
 * 
 * REGLAS ABSOLUTAS:
 * 1. NO decide lifecycle (ApplicationBootstrapManager lo hace)
 * 2. NO procesa eventos SSE (RealtimeOrchestrator lo hace)
 * 3. NO transporta SSE (ssePool lo hace)
 * 4. Solo OBSERVA, DIAGNOSTICA y EMITE DECISIONES
 * 
 * @singleton
 * @enterprise
 */

import { queryClient } from '@/lib/queryClient';
import { leaderElection, LeadershipState } from '@/lib/realtime/LeaderElection';
import { telemetry, TelemetryEnvelope, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';

// ===========================================
// TYPES & INTERFACES
// ===========================================

/**
 * Estados formales del Motor 4
 */
export enum DataIntegrityState {
    DATA_HEALTHY = 'DATA_HEALTHY',     // Todo OK: SSE healthy + datos frescos
    DATA_STALE = 'DATA_STALE',         // Datos viejos pero no crítico
    DATA_SUSPECT = 'DATA_SUSPECT',     // Posible inconsistencia
    DATA_CORRUPT = 'DATA_CORRUPT',     // ⚠️ SOLO si VersionedStorageManager checksum mismatch
    HEALING = 'HEALING'                // Ejecutando acciones de healing
}

/**
 * Decisiones que el motor puede emitir (intenciones, no acciones directas)
 * Esto permite testing, telemetría y override manual
 */
export type IntegrityDecision =
    | { type: 'SOFT_REFETCH'; queryKey: unknown[]; reason: string }
    | { type: 'PARTIAL_INVALIDATE'; queryKey: unknown[]; reason: string }
    | { type: 'FULL_INVALIDATE'; reason: string }
    | { type: 'NOOP_LOG'; message: string };

/**
 * Eventos de entrada que el motor procesa
 */
export type IntegrityEvent =
    | { type: 'lifecycle:running' }
    | { type: 'lifecycle:recovered' }
    | { type: 'lifecycle:suspended' }
    | { type: 'realtime:status'; status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' }
    | { type: 'query:error'; queryKey: unknown[] }
    | { type: 'storage:corrupt'; key: string }
    | { type: 'integrity:tick' }
    // 🚀 PROACTIVE TRIGGERS (Fase E)
    | { type: 'leader:failover_completed' }
    | { type: 'telemetry:anomaly'; envelope: TelemetryEnvelope };

/**
 * Metadata de una query trackeada
 */
interface TrackedQuery {
    queryKey: unknown[];
    lastFreshAt: number;
    errorCount: number;
    threshold: number; // en ms
}

type StateListener = (state: DataIntegrityState) => void;
type DecisionListener = (decision: IntegrityDecision) => void;

// ===========================================
// INTEGRITY RULES
// ===========================================

/**
 * Reglas de freshness por query pattern
 * Queries con staleTime: Infinity necesitan supervisión externa
 */
const QUERY_FRESHNESS_RULES: Record<string, number> = {
    'reports': 10 * 60 * 1000,      // 10 min
    'comments': 10 * 60 * 1000,     // 10 min
    'chats,messages': 5 * 60 * 1000, // 5 min
    'chats,rooms': 0,                // Ya tiene staleTime finito, skip
    'notifications': 0,              // Ya tiene staleTime finito, skip
};

/**
 * Obtiene el threshold para una queryKey
 */
function getThresholdForQuery(queryKey: unknown[]): number {
    const keyStr = JSON.stringify(queryKey);

    for (const [pattern, threshold] of Object.entries(QUERY_FRESHNESS_RULES)) {
        if (keyStr.includes(pattern)) {
            return threshold;
        }
    }

    return 0; // No tracking needed
}

// ===========================================
// DATA INTEGRITY ENGINE
// ===========================================

class DataIntegrityEngine {
    private state: DataIntegrityState = DataIntegrityState.DATA_HEALTHY;
    private trackedQueries: Map<string, TrackedQuery> = new Map();
    private stateListeners: Set<StateListener> = new Set();
    private decisionListeners: Set<DecisionListener> = new Set();

    // ⚠️ AJUSTE 2: HEALING es mutuamente excluyente
    private isHealingInProgress: boolean = false;
    private healingTimeoutId: ReturnType<typeof setTimeout> | null = null;
    private readonly HEALING_TIMEOUT_MS = 30_000; // 30s max healing time

    // ⚠️ AJUSTE 3: tick pausable
    private tickIntervalId: ReturnType<typeof setInterval> | null = null;
    private readonly TICK_INTERVAL_MS = 60_000; // 60s
    private isTickPaused: boolean = false;

    // Realtime status tracking
    private realtimeStatus: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' = 'HEALTHY';
    private realtimeDegradedSince: number | null = null;
    private readonly DEGRADED_THRESHOLD_MS = 30_000; // 30s in DEGRADED triggers suspect

    constructor() {
        console.debug('[Integrity] Motor 4 initialized');
    }

    // ===========================================
    // PUBLIC API
    // ===========================================

    /**
     * Inicia el motor (llamar después del boot)
     */
    public start(): void {
        if (this.tickIntervalId) return; // Already started

        this.tickIntervalId = setInterval(() => {
            if (!this.isTickPaused) {
                this.processEvent({ type: 'integrity:tick' });
            }
        }, this.TICK_INTERVAL_MS);

        // 🚀 PROACTIVE SUBSCRIPTIONS (M11 + M8)

        // 1. Leader Failover (P1)
        leaderElection.onChange((state) => {
            if (state === LeadershipState.LEADING) {
                this.processEvent({ type: 'leader:failover_completed' });
            }
        });

        // 2. Telemetry Anomalies (P3)
        telemetry.subscribe((env) => {
            // Only care about SYSTEM signals or ERRORs that might indicate data loss
            if (env.severity === TelemetrySeverity.ERROR ||
                (env.severity === TelemetrySeverity.WARN && env.engine === 'SSE')) {
                this.processEvent({ type: 'telemetry:anomaly', envelope: env });
            }
        });

        console.debug('[Integrity] ✅ Engine started with Proactive Triggers (M11, M8)');
    }

    /**
     * Detiene el motor
     */
    public stop(): void {
        if (this.tickIntervalId) {
            clearInterval(this.tickIntervalId);
            this.tickIntervalId = null;
        }
        if (this.healingTimeoutId) {
            clearTimeout(this.healingTimeoutId);
            this.healingTimeoutId = null;
        }
        console.log('[Integrity] Engine stopped');
    }

    /**
     * Punto de entrada principal para eventos
     */
    public processEvent(event: IntegrityEvent): void {
        console.debug(`[Integrity] EVENT: ${event.type}`);

        switch (event.type) {
            case 'lifecycle:running':
                this.onLifecycleRunning();
                break;
            case 'lifecycle:recovered':
                this.onLifecycleRecovered();
                break;
            case 'lifecycle:suspended':
                this.onLifecycleSuspended();
                break;
            case 'realtime:status':
                this.onRealtimeStatus(event.status);
                break;
            case 'query:error':
                this.onQueryError(event.queryKey);
                break;
            case 'storage:corrupt':
                this.onStorageCorrupt(event.key);
                break;
            case 'integrity:tick':
                this.onTick();
                break;
            case 'leader:failover_completed':
                this.onLeaderFailover();
                break;
            case 'telemetry:anomaly':
                this.onTelemetryAnomaly(event.envelope);
                break;
        }
    }

    /**
     * Obtiene el estado actual
     */
    public getState(): DataIntegrityState {
        return this.state;
    }

    /**
     * Suscribirse a cambios de estado
     */
    public onStateChange(listener: StateListener): () => void {
        this.stateListeners.add(listener);
        return () => this.stateListeners.delete(listener);
    }

    /**
     * Suscribirse a decisiones emitidas
     * Útil para testing, telemetría, override manual
     */
    public onDecision(listener: DecisionListener): () => void {
        this.decisionListeners.add(listener);
        return () => this.decisionListeners.delete(listener);
    }

    // ===========================================
    // EVENT HANDLERS
    // ===========================================

    private onLifecycleRunning(): void {
        // ⚠️ AJUSTE 3: reanudar tick
        this.isTickPaused = false;
        console.debug('[Integrity] Tick resumed (lifecycle running)');
    }

    private onLifecycleRecovered(): void {
        // ⚠️ AJUSTE 3: reanudar tick
        this.isTickPaused = false;

        // Forzar verificación de todas las queries trackeadas
        console.debug('[Integrity] 🚑 Post-recovery verification triggered');
        this.verifyAllTrackedQueries();
    }

    private onLifecycleSuspended(): void {
        // ⚠️ AJUSTE 3: pausar tick en SUSPENDED
        this.isTickPaused = true;
        console.debug('[Integrity] Tick paused (lifecycle suspended)');
    }

    private onRealtimeStatus(status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED'): void {
        const prevStatus = this.realtimeStatus;
        this.realtimeStatus = status;

        if (status === 'HEALTHY') {
            this.realtimeDegradedSince = null;

            // Si estábamos en SUSPECT por realtime, verificar si healing necesario
            if (this.state === DataIntegrityState.DATA_SUSPECT) {
                this.verifyAllTrackedQueries();
            }
        } else if (status === 'DEGRADED' || status === 'DISCONNECTED') {
            if (!this.realtimeDegradedSince) {
                this.realtimeDegradedSince = Date.now();
            }

            // Marcar como SUSPECT si no estamos en healing
            if (this.state === DataIntegrityState.DATA_HEALTHY) {
                this.setState(DataIntegrityState.DATA_SUSPECT);
            }
        }

        console.debug(`[Integrity] Realtime status: ${prevStatus} → ${status}`);
    }

    private onQueryError(queryKey: unknown[]): void {
        const keyStr = JSON.stringify(queryKey);
        const tracked = this.trackedQueries.get(keyStr);

        if (tracked) {
            tracked.errorCount++;

            if (tracked.errorCount >= 3) {
                console.warn(`[Integrity] Query ${keyStr} has ${tracked.errorCount} errors`);

                if (this.state !== DataIntegrityState.DATA_SUSPECT &&
                    this.state !== DataIntegrityState.HEALING) {
                    this.setState(DataIntegrityState.DATA_SUSPECT);
                }
            }
        }
    }

    /**
     * ⚠️ AJUSTE 1: DATA_CORRUPT solo por VersionedStorageManager checksum mismatch
     */
    private onStorageCorrupt(key: string): void {
        console.error(`[Integrity] ❌ CORRUPTION detected: ${key} (VersionedStorageManager checksum mismatch)`);

        if (this.state !== DataIntegrityState.HEALING) {
            this.setState(DataIntegrityState.DATA_CORRUPT);
            this.triggerHealing('storage_corruption');
        }
    }

    private onTick(): void {
        if (this.state === DataIntegrityState.HEALING) {
            // ⚠️ AJUSTE 2: No hacer nada durante healing
            return;
        }

        // Verificar si realtime lleva mucho tiempo en DEGRADED
        if (this.realtimeDegradedSince) {
            const degradedFor = Date.now() - this.realtimeDegradedSince;

            if (degradedFor > this.DEGRADED_THRESHOLD_MS * 10) { // 5 min
                console.warn(`[Integrity] Realtime DEGRADED for ${Math.floor(degradedFor / 1000)}s, triggering healing`);
                this.triggerHealing('realtime_prolonged_degraded');
                return;
            }
        }

        // Verificar age de queries
        this.checkQueryAges();
    }

    private onLeaderFailover(): void {
        console.log('[Integrity] 👑 Leader Failover detected. Verifying consistency...');
        // Force immediate verification regardless of state
        // This is P1 Priority
        this.verifyAllTrackedQueries();
    }

    private onTelemetryAnomaly(env: TelemetryEnvelope): void {
        // P3 Priority - Reactive check
        if (this.state === DataIntegrityState.DATA_HEALTHY) {
            console.warn(`[Integrity] Telemetry Anomaly detected (${env.engine}), entering SUSPECT.`);
            this.setState(DataIntegrityState.DATA_SUSPECT);
        }
    }

    // ===========================================
    // CORE LOGIC
    // ===========================================

    /**
     * Registra una query para tracking de freshness
     */
    public trackQuery(queryKey: unknown[]): void {
        const threshold = getThresholdForQuery(queryKey);

        if (threshold === 0) return; // No tracking needed

        const keyStr = JSON.stringify(queryKey);

        if (!this.trackedQueries.has(keyStr)) {
            this.trackedQueries.set(keyStr, {
                queryKey,
                lastFreshAt: Date.now(),
                errorCount: 0,
                threshold,
            });
            console.debug(`[Integrity] Tracking query: ${keyStr} (threshold: ${threshold / 1000}s)`);
        }
    }

    /**
     * Marca una query como fresca (llamar después de fetch exitoso)
     */
    public markQueryFresh(queryKey: unknown[]): void {
        const keyStr = JSON.stringify(queryKey);
        const tracked = this.trackedQueries.get(keyStr);

        if (tracked) {
            tracked.lastFreshAt = Date.now();
            tracked.errorCount = 0;
        }
    }

    /**
     * Verifica la edad de todas las queries trackeadas
     */
    private checkQueryAges(): void {
        const now = Date.now();
        const staleQueries: TrackedQuery[] = [];

        for (const tracked of this.trackedQueries.values()) {
            const age = now - tracked.lastFreshAt;

            if (age > tracked.threshold) {
                staleQueries.push(tracked);
            }
        }

        if (staleQueries.length > 0) {
            console.debug(`[Integrity] Found ${staleQueries.length} stale queries`);

            if (this.state === DataIntegrityState.DATA_HEALTHY) {
                this.setState(DataIntegrityState.DATA_STALE);
            }

            // Emit soft refetch decisions
            for (const stale of staleQueries) {
                this.emitDecision({
                    type: 'SOFT_REFETCH',
                    queryKey: stale.queryKey,
                    reason: `age=${Math.floor((now - stale.lastFreshAt) / 1000)}s > threshold=${stale.threshold / 1000}s`,
                });
            }
        } else if (this.state === DataIntegrityState.DATA_STALE) {
            // All queries fresh, return to healthy
            this.setState(DataIntegrityState.DATA_HEALTHY);
        }
    }

    /**
     * Verifica todas las queries trackeadas (post-recovery)
     */
    private verifyAllTrackedQueries(): void {
        if (this.state === DataIntegrityState.HEALING) return;

        const now = Date.now();
        let hasStale = false;

        for (const tracked of this.trackedQueries.values()) {
            const age = now - tracked.lastFreshAt;

            if (age > tracked.threshold) {
                hasStale = true;
                this.emitDecision({
                    type: 'SOFT_REFETCH',
                    queryKey: tracked.queryKey,
                    reason: `post_recovery_verification, age=${Math.floor(age / 1000)}s`,
                });
            }
        }

        if (!hasStale && this.realtimeStatus === 'HEALTHY') {
            this.setState(DataIntegrityState.DATA_HEALTHY);
        }
    }

    /**
     * ⚠️ AJUSTE 2: Trigger healing con protección contra re-entrada
     */
    private triggerHealing(reason: string): void {
        // Guard: no re-entrar si ya estamos en healing
        if (this.isHealingInProgress) {
            console.warn(`[Integrity] Healing already in progress, ignoring trigger: ${reason}`);
            return;
        }

        this.isHealingInProgress = true;
        this.setState(DataIntegrityState.HEALING);

        console.log(`[Integrity] 🏥 HEALING started: ${reason}`);

        // Timeout de seguridad para no quedarnos en HEALING forever
        this.healingTimeoutId = setTimeout(() => {
            console.warn('[Integrity] ⚠️ Healing timeout reached, forcing completion');
            this.completeHealing(false);
        }, this.HEALING_TIMEOUT_MS);

        // Ejecutar acciones de healing
        this.executeHealing(reason);
    }

    /**
     * Ejecuta las acciones de healing
     */
    private async executeHealing(reason: string): Promise<void> {
        try {
            if (reason === 'storage_corruption') {
                // Corrupción de storage: invalidar todo
                this.emitDecision({
                    type: 'FULL_INVALIDATE',
                    reason: 'storage_corruption_detected',
                });
            } else if (reason === 'realtime_prolonged_degraded') {
                // Realtime muerto por mucho tiempo: invalidar queries críticas
                const criticalPatterns = ['chats', 'notifications'];

                for (const pattern of criticalPatterns) {
                    this.emitDecision({
                        type: 'PARTIAL_INVALIDATE',
                        queryKey: [pattern],
                        reason: 'realtime_prolonged_degraded',
                    });
                }

                // También soft refetch de reports/comments
                for (const tracked of this.trackedQueries.values()) {
                    this.emitDecision({
                        type: 'SOFT_REFETCH',
                        queryKey: tracked.queryKey,
                        reason: 'healing_after_prolonged_degraded',
                    });
                }
            }

            // Simular tiempo de healing (en realidad las decisiones son async)
            setTimeout(() => {
                this.completeHealing(true);
            }, 500);

        } catch (error) {
            console.error('[Integrity] Healing error:', error);
            this.completeHealing(false);
        }
    }

    /**
     * Completa el proceso de healing
     */
    private completeHealing(success: boolean): void {
        if (this.healingTimeoutId) {
            clearTimeout(this.healingTimeoutId);
            this.healingTimeoutId = null;
        }

        this.isHealingInProgress = false;

        if (success) {
            console.debug('[Integrity] ✅ Healing completed successfully');
            this.setState(DataIntegrityState.DATA_HEALTHY);
        } else {
            console.warn('[Integrity] ⚠️ Healing completed with issues');
            // Volver a SUSPECT para que el próximo tick lo re-evalúe
            this.setState(DataIntegrityState.DATA_SUSPECT);
        }
    }

    // ===========================================
    // STATE MANAGEMENT
    // ===========================================

    private setState(newState: DataIntegrityState): void {
        if (this.state === newState) return;

        console.debug(`[Integrity] STATE_TRANSITION from=${this.state} to=${newState}`);

        this.state = newState;
        this.stateListeners.forEach(fn => fn(newState));
    }

    /**
     * ⚠️ AJUSTE 4: Emite decisiones (intenciones), no ejecuta directamente
     */
    private emitDecision(decision: IntegrityDecision): void {
        const logDetails = decision.type === 'NOOP_LOG'
            ? decision.message
            : `${'queryKey' in decision ? JSON.stringify(decision.queryKey) : ''} reason=${decision.reason}`;

        console.debug(`[Integrity] DECISION: ${decision.type}`, logDetails);

        // Notificar listeners (para testing/telemetría/override)
        this.decisionListeners.forEach(fn => fn(decision));

        // Ejecutar la decisión (comportamiento por defecto)
        this.executeDecision(decision);
    }

    /**
     * Ejecuta una decisión (puede ser overrideado en testing)
     */
    private executeDecision(decision: IntegrityDecision): void {
        switch (decision.type) {
            case 'SOFT_REFETCH':
                // Buscar la query y hacer fetch sin invalidar
                const queries = queryClient.getQueryCache().findAll({
                    queryKey: decision.queryKey,
                    type: 'active',
                });
                for (const query of queries) {
                    query.fetch();
                }
                break;

            case 'PARTIAL_INVALIDATE':
                // Invalidar pattern específico (bypass del guard para chats)
                // Nota: El guard de queryClient bloquea 'reports', 
                // pero permite 'chats' y 'notifications'
                queryClient.invalidateQueries({ queryKey: decision.queryKey });
                break;

            case 'FULL_INVALIDATE':
                // Invalidación de emergencia (solo queries críticas no protegidas)
                queryClient.invalidateQueries({ queryKey: ['chats'] });
                queryClient.invalidateQueries({ queryKey: ['notifications'] });
                queryClient.invalidateQueries({ queryKey: ['users'] });
                break;

            case 'NOOP_LOG':
                // Solo log, no acción
                break;
        }
    }
}

// ===========================================
// SINGLETON EXPORT
// ===========================================

export const dataIntegrityEngine = new DataIntegrityEngine();
