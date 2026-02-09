import { Backoff } from './Backoff';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';

/**
 * Traffic State Definition
 */
export enum TrafficState {
    IDLE = 'IDLE',
    RATE_LIMITED = 'RATE_LIMITED',
    BACKING_OFF = 'BACKING_OFF',
    ALLOWING = 'ALLOWING',
    CONGESTED = 'CONGESTED'
}

/**
 * Motor 7 - Client-side Traffic Control Engine
 * 
 * Objectives:
 * 1. Global Rate Limit Management (429 handling)
 * 2. Serialized Action Queue (Atomic actions)
 * 3. Coordinated Backoff
 */
class TrafficController {
    private state: TrafficState = TrafficState.IDLE;
    private globalBackoff = new Backoff(2000, 60000); // Start at 2s, cap at 60s
    private resumePromise: Promise<void> | null = null;
    private resumeResolver: (() => void) | null = null;

    // Serial queue for sensitive actions
    private serialQueue: Promise<any> = Promise.resolve();
    private queueDepth = 0;
    private readonly MAX_QUEUE_DEPTH = 50; // 🛑 Bounded Queue Limit (Phase F)

    // 📊 Stats básicos (proporcional al volumen de SafeSpot)
    private stats = {
        rateLimitHits: 0,
        queuedActions: 0,
        completedActions: 0,
        rejectedActions: 0,
    };

    /**
     * Semáforo: Wait until traffic is allowed
     */
    async waitUntilAllowed(): Promise<void> {
        if (this.state === TrafficState.IDLE) return;

        if (this.resumePromise) {
            console.debug(`[Traffic] 🚦 Request paused. Current state: ${this.state}`);

            // 📡 MOTOR 8: Trace Pause
            telemetry.emit({
                engine: 'Traffic',
                severity: TelemetrySeverity.DEBUG,
                engineState: this.state,
                payload: { action: 'wait_until_allowed' }
            });

            await this.resumePromise;
        }
    }

    /**
     * Report a 429 or congestion event
     */
    reportRateLimit() {
        if (this.state === TrafficState.RATE_LIMITED || this.state === TrafficState.BACKING_OFF) return;

        this.stats.rateLimitHits++;
        this.state = TrafficState.RATE_LIMITED;
        const delay = this.globalBackoff.getDelay();

        console.warn(`[Traffic] 🔴 RATE_LIMITED detected. Entering global backoff: ${delay}ms`);
        this.state = TrafficState.BACKING_OFF;

        // Create the blocking promise
        this.resumePromise = new Promise((resolve) => {
            this.resumeResolver = resolve;
        });

        // Auto-resume after backoff
        setTimeout(() => this.resume(), delay);
    }

    /**
     * Resume traffic
     */
    resume() {
        if (this.state === TrafficState.IDLE) return;

        this.state = TrafficState.ALLOWING;
        console.log('[Traffic] 🟢 RESUMED - Releasing global traffic');

        if (this.resumeResolver) {
            this.resumeResolver();
            this.resumeResolver = null;
            this.resumePromise = null;
        }

        // Return to IDLE after clearing the gate
        this.state = TrafficState.IDLE;
    }

    /**
     * Execute sensitive action in serial queue (Concurrency: 1)
     */
    async enqueueSerial<T>(action: () => Promise<T>, label = 'anonymous'): Promise<T> {
        // 🛑 Bounded Queue Check (M7 Fix)
        if (this.queueDepth >= this.MAX_QUEUE_DEPTH) {
            this.stats.rejectedActions++;
            console.error(`[Traffic] 🛑 SERIAL_QUEUE FULL (${this.queueDepth}). Rejecting: ${label}`);
            throw new Error('Traffic Congestion: Serial Queue Full');
        }

        this.stats.queuedActions++;
        this.queueDepth++;

        const result = this.serialQueue.then(async () => {
            console.debug(`[Traffic] 🔄 SERIAL_QUEUE_EXECUTING: ${label} (Pending: ${this.queueDepth})`);

            // 📡 MOTOR 8: Trace Execution
            const spanId = `span_${self.crypto.randomUUID().substring(0, 8)}`;
            telemetry.emit({
                engine: 'Traffic',
                severity: TelemetrySeverity.DEBUG,
                spanId,
                payload: { action: 'serial_queue_executing', label, queueDepth: this.queueDepth }
            });

            try {
                const result = await action();
                this.stats.completedActions++;
                telemetry.emit({
                    engine: 'Traffic',
                    severity: TelemetrySeverity.DEBUG,
                    spanId,
                    payload: { action: 'serial_queue_finished', label }
                });
                return result;
            } finally {
                console.debug(`[Traffic] ✅ SERIAL_QUEUE_FINISHED: ${label}`);
                this.queueDepth--; // Release slot
            }
        });

        // Chaining to current queue
        this.serialQueue = result.catch(() => { }); // Prevent individual crash from stalling queue

        return result;
    }

    /**
     * Reset backoff count (call on successful request)
     */
    notifySuccess() {
        if (this.globalBackoff.count > 0) {
            this.globalBackoff.reset();
        }
    }

    getState() {
        return this.state;
    }

    // 📊 Métricas básicas
    getMetrics(): { rateLimitHits: number; queuedActions: number; completedActions: number; rejectedActions: number } {
        return { ...this.stats };
    }

    getHealthStatus(): 'HEALTHY' | 'CONGESTED' | 'RATE_LIMITED' {
        if (this.state === TrafficState.RATE_LIMITED || this.state === TrafficState.BACKING_OFF) {
            return 'RATE_LIMITED';
        }
        if (this.queueDepth > this.MAX_QUEUE_DEPTH * 0.8 || this.state === TrafficState.CONGESTED) {
            return 'CONGESTED';
        }
        return 'HEALTHY';
    }

    resetMetrics(): void {
        this.stats = { rateLimitHits: 0, queuedActions: 0, completedActions: 0, rejectedActions: 0 };
    }

    /**
     * 🧹 MEMORY FIX: Limpia serialQueue, queueDepth y estado
     * Llamar en logout para prevenir memory leaks y contaminación de sesión
     */
    clear(): void {
        // Resetear la cadena de promesas para liberar referencias acumuladas
        this.serialQueue = Promise.resolve();
        this.queueDepth = 0;
        
        // Resetear backoff para el próximo usuario
        this.globalBackoff.reset();
        
        // Limpiar estado de rate limiting si está activo
        if (this.state !== TrafficState.IDLE) {
            if (this.resumeResolver) {
                this.resumeResolver();
                this.resumeResolver = null;
                this.resumePromise = null;
            }
            this.state = TrafficState.IDLE;
        }
        
        // Resetear stats
        this.resetMetrics();
        
        console.debug('[Traffic] 🧹 Cleared queue and reset backoff');
    }
}

export const trafficController = new TrafficController();
