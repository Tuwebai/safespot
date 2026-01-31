import { telemetryHub } from './telemetry/TelemetryHub';
import { eventAuthorityLog } from './realtime/EventAuthorityLog';

/**
 * 🕵️‍♂️ Motor 9: Incident Replay Engine (CausalStitcher)
 * 
 * Un sistema de lectura forense que reconstruye historias causales determinísticas.
 * NO procesa, NO muta, NO genera efectos. Solo explica.
 */

export type CausalConclusion =
    | 'SUCCESS_VISIBLE'           // Flujo completo, efecto UI confirmado
    | 'RENDER_SKIPPED'           // Llegó a caché pero el hook no respondió (route/unmount)
    | 'FILTERED_OUT'             // Descartado por lógica/filtro en el orquestador
    | 'DUPLICATE_SUPPRESSED'     // Bloqueado por la autoridad (already processed)
    | 'GAP_DETECTED';            // Historia incompleta o inconsistencia sistémica

export interface CausalTraceStep {
    t: number;
    engine: string;
    signal: string;
    payload?: any;
}

export interface CausalTraceReport {
    eventId: string | null;
    traceId: string | null;
    conclusion: CausalConclusion;
    diagnosis: string;
    timeline: CausalTraceStep[];
}

export class CausalStitcher {
    /**
     * inspectEvent() - Reconstrucción forense por ID de evento o traza
     */
    public static inspectEvent(id: string): CausalTraceReport {
        const history = telemetryHub.getHistory();

        // 1. Pivot & Filter: Buscar todas las señales relacionadas
        let signals = history.filter(s =>
            s.traceId === id ||
            (s.payload && (s.payload.eventId === id || s.payload.entityId === id))
        );

        // Correlación cruzada si el ID es un eventId y no un traceId
        if (signals.length > 0 && !signals.some(s => s.traceId === id)) {
            const traceIdFound = signals[0].traceId;
            signals = history.filter(s => s.traceId === traceIdFound);
        }

        const timeline = signals
            .sort((a, b) => a.timestamp - b.timestamp)
            .map(s => ({
                t: s.timestamp,
                engine: s.engine,
                signal: s.payload?.action || 'unknown_signal',
                payload: s.payload
            }));

        // 2. Cross-Reference con AuthorityLog (Solo lectura)
        const isAuthoritativeProcessed = this.checkAuthority(id, signals);

        // 3. Diagnose: Aplicar reglas determinísticas de causalidad
        const report = this.generateReport(id, signals, timeline, isAuthoritativeProcessed);

        return report;
    }

    private static checkAuthority(id: string, signals: any[]): boolean {
        // Intentamos extraer el eventId de las señales si el ID proporcionado fuera un traceId
        const eventId = signals.find(s => s.payload?.eventId)?.payload?.eventId || id;

        // Verificamos si la autoridad lo tiene registrado
        // Nota: asumiendo que eventAuthorityLog expone un método de consulta o revisando su Set interno si fuera accesible.
        // Como es una clase privada, dependemos de qué tan expuesto esté. Si no, tratamos como GAP.
        return (eventAuthorityLog as any).inMemoryLog?.has(eventId) || false;
    }

    private static generateReport(
        originalId: string,
        rawSignals: any[],
        timeline: CausalTraceStep[],
        isAuthoritativeProcessed: boolean
    ): CausalTraceReport {
        const traceId = rawSignals[0]?.traceId || null;

        // 🔍 Identificación de etapas (No inferencia de nombres, uso de flags registradas)
        const hasReceived = timeline.some(s => s.signal === 'event_received');
        const hasStarted = timeline.some(s => s.signal === 'raw_event_processing_start');
        const hasSuppressed = timeline.some(s => s.signal === 'event_suppressed_duplicate');
        const hasDiscarded = timeline.some(s => s.signal === 'event_discarded_by_filter');
        const hasApplied = timeline.some(s => s.signal === 'cache_patch_applied');
        const hasUI = timeline.some(s => s.signal === 'ui_effect_triggered');

        let conclusion: CausalConclusion = 'GAP_DETECTED';
        let diagnosis = 'Historia causal incompleta.';

        // --- REGLAS DETERMINÍSTICAS (ORDEN DE PRECEDENCIA) ---

        // 1. ÉXITO
        if (hasUI) {
            conclusion = 'SUCCESS_VISIBLE';
            diagnosis = 'Evento procesado y manifestación UI confirmada.';
            return { eventId: originalId, traceId, conclusion, diagnosis, timeline };
        }

        // 2. SKIPS POR RUTA (Context Awareness Hardened)
        if (hasApplied) {
            const cacheSignal = timeline.find(s => s.signal === 'cache_patch_applied');
            const routeContext = cacheSignal?.payload?.context?.route || null;

            conclusion = 'RENDER_SKIPPED';
            diagnosis = routeContext
                ? `Cambio inyectado en caché, pero UI no reaccionó. Contexto de ruta: ${routeContext}.`
                : 'Cambio inyectado en caché, pero no hay señales de UI posteriores.';
            return { eventId: originalId, traceId, conclusion, diagnosis, timeline };
        }

        // 3. SUPRESIÓN Y FILTRADO
        if (hasDiscarded) {
            conclusion = 'FILTERED_OUT';
            const signal = timeline.find(s => s.signal === 'event_discarded_by_filter');
            diagnosis = `Descartado por Orquestador. Razón: ${signal?.payload?.reason || 'Sin razón específica'}.`;
            return { eventId: originalId, traceId, conclusion, diagnosis, timeline };
        }

        if (hasSuppressed) {
            conclusion = 'DUPLICATE_SUPPRESSED';
            diagnosis = 'La Autoridad detectó un duplicado y bloqueó el flujo.';
            return { eventId: originalId, traceId, conclusion, diagnosis, timeline };
        }

        // 4. DETECCIÓN DE GAPS CAUSALES
        if (isAuthoritativeProcessed && !hasApplied && !hasDiscarded && !hasSuppressed) {
            conclusion = 'GAP_DETECTED';
            diagnosis = 'CRÍTICO: La Autoridad confirma procesamiento, pero no existen señales causales de impacto (Caché/UI). Posible pérdida de rastro en el pipeline.';
        } else if (hasReceived && !hasStarted) {
            conclusion = 'GAP_DETECTED';
            diagnosis = 'Recibido en red pero nunca entró al Orquestador (Buffer loss o crash síncrono).';
        } else if (rawSignals.length === 0) {
            diagnosis = 'No se encontraron señales para este ID en el historial actual.';
        }

        return {
            eventId: originalId,
            traceId,
            conclusion,
            diagnosis,
            timeline
        };
    }
}

/**
 * SafeSpot Inspector API
 */
export const inspectEvent = (id: string) => {
    const report = CausalStitcher.inspectEvent(id);
    const style = report.conclusion === 'GAP_DETECTED' ? 'color: #ff4444; font-weight: bold;' : 'color: #44ff44;';

    console.group(`🕵️‍♂️ SafeSpot Causal Report: %c${report.conclusion}`, style);
    console.log(`📌 TraceId: ${report.traceId}`);
    console.log(`📖 Diagnosis: ${report.diagnosis}`);

    if (report.timeline.length > 0) {
        console.table(report.timeline.map(s => ({
            T: s.t.toFixed(2),
            Engine: s.engine,
            Signal: s.signal,
            Route: s.payload?.context?.route || 'N/A'
        })));
    }
    console.groupEnd();
    return report;
};
