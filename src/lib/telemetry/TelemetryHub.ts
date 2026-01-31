import { telemetry, TelemetryEnvelope, TelemetrySeverity } from './TelemetryEngine';

/**
 * Phase 3: Global Signal Hub
 * 
 * Passive collector for all telemetry signals.
 * Can be used for:
 * 1. Diagnostic inspection
 * 2. Anomaly detection (Backpressure, Latency)
 * 3. Event Replay preparation
 */
class TelemetryHub {
    private history: TelemetryEnvelope[] = [];
    private readonly MAX_HISTORY = 500;

    constructor() {
        telemetry.subscribe((envelope) => {
            this.history.push(envelope);
            if (this.history.length > this.MAX_HISTORY) {
                this.history.shift();
            }

            this.analyze(envelope);
        });
    }

    private analyze(envelope: TelemetryEnvelope) {
        // Detect persistent backpressure
        if (envelope.engine === 'Traffic' && envelope.payload.action === 'wait_until_allowed') {
            // Potential congestion signal
        }

        // Detect SSE Struggles
        if (envelope.engine === 'SSE' && envelope.severity === TelemetrySeverity.WARN) {
            console.warn(`[Hub] 📡 SSE Connectivity Struggle detected for instance ${envelope.instanceId}`);
        }
    }

    public getHistory() {
        return [...this.history];
    }

    public getTracesById(traceId: string) {
        return this.history.filter(e => e.traceId === traceId);
    }

    public clear() {
        this.history = [];
    }
}

export const telemetryHub = new TelemetryHub();
