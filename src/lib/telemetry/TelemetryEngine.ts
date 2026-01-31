/**
 * Motor 8: Unified Telemetry Engine (Core)
 * 
 * Responsibilities:
 * 1. Instance Identification (instanceId)
 * 2. Trace Context Management (traceId, spanId)
 * 3. Telemetry Envelope Generation
 */

export enum TelemetrySeverity {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    SIGNAL = 'SIGNAL',
    WARN = 'WARN',
    ERROR = 'ERROR'
}

export interface TelemetryEnvelope {
    traceId: string;
    spanId: string;
    instanceId: string;
    engine: string;
    engineState?: string;
    severity: TelemetrySeverity;
    timestamp: number;
    payload: any;
}

// 1. Instance Identification (Ephemeral per tab)
const INSTANCE_KEY = 'safespot_telemetry_instance_id';
const getOrCreateInstanceId = (): string => {
    if (typeof window === 'undefined') return 'server-side';

    let id = sessionStorage.getItem(INSTANCE_KEY);
    if (!id) {
        id = `inst_${self.crypto.randomUUID().substring(0, 8)}`;
        sessionStorage.setItem(INSTANCE_KEY, id);
    }
    return id;
};

const instanceId = getOrCreateInstanceId();

// 2. Trace Context Manager (Simplified Async Context)
let currentTraceId: string | null = null;

/**
 * Enterprise Telemetry Engine
 */
class TelemetryEngine {
    private listeners: ((envelope: TelemetryEnvelope) => void)[] = [];

    /**
     * Start a new trace or adopt an existing one
     */
    public startTrace(existingId?: string): string {
        const id = existingId || `tr_${self.crypto.randomUUID().substring(0, 8)}`;
        currentTraceId = id;
        return id;
    }

    public getTraceId(): string {
        return currentTraceId || this.startTrace();
    }

    public getInstanceId(): string {
        return instanceId;
    }

    /**
     * Execute a block of code within a specific trace context
     */
    public runInContext<T>(traceId: string, fn: () => T): T {
        const previous = currentTraceId;
        currentTraceId = traceId;
        try {
            return fn();
        } finally {
            currentTraceId = previous;
        }
    }

    /**
     * Emit a telemetry signal
     */
    public emit(params: {
        engine: string;
        severity: TelemetrySeverity;
        payload: any;
        engineState?: string;
        traceId?: string;
        spanId?: string;
    }) {
        const envelope: TelemetryEnvelope = {
            traceId: params.traceId || this.getTraceId(),
            spanId: params.spanId || `span_${self.crypto.randomUUID().substring(0, 8)}`,
            instanceId,
            engine: params.engine,
            engineState: params.engineState,
            severity: params.severity,
            timestamp: performance.now(),
            payload: params.payload
        };

        // Notify all subscribers (Internal Hub)
        this.listeners.forEach(fn => fn(envelope));

        // 🔴 ENTERPRISE DEBUG LOGGING: Consistent across all engines
        this.logToConsole(envelope);
    }

    private logToConsole(env: TelemetryEnvelope) {
        // M8 Fix: Strict Production Silence (Phase F)
        if (!import.meta.env.DEV && (
            env.severity === TelemetrySeverity.DEBUG ||
            env.severity === TelemetrySeverity.INFO ||
            env.severity === TelemetrySeverity.SIGNAL
        )) return;

        const icon = this.getSeverityIcon(env.severity);
        const prefix = `[${env.instanceId}] [${env.traceId}] [${env.engine}]`;

        const logFn = this.getLogFunction(env.severity);
        logFn(`${icon} ${prefix}`, env.payload, env.engineState ? `(State: ${env.engineState})` : '');
    }

    private getSeverityIcon(s: TelemetrySeverity): string {
        switch (s) {
            case TelemetrySeverity.ERROR: return '🔴';
            case TelemetrySeverity.WARN: return '⚠️';
            case TelemetrySeverity.SIGNAL: return '📡';
            case TelemetrySeverity.INFO: return 'ℹ️';
            default: return '🔍';
        }
    }

    private getLogFunction(s: TelemetrySeverity) {
        switch (s) {
            case TelemetrySeverity.ERROR: return console.error;
            case TelemetrySeverity.WARN: return console.warn;
            default: return console.debug; // Info and Signal also go to debug to keep console clean
        }
    }

    public subscribe(fn: (envelope: TelemetryEnvelope) => void) {
        this.listeners.push(fn);
        return () => {
            this.listeners = this.listeners.filter(l => l !== fn);
        };
    }
}

export const telemetry = new TelemetryEngine();
