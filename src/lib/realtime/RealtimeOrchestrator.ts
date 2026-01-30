import { ssePool } from '../ssePool';
import { localProcessedLog } from './LocalProcessedLog';
import { API_BASE_URL } from '../api';
import { queryClient } from '../queryClient';
import { getClientId } from '../clientId';
import { dataIntegrityEngine } from '@/engine/integrity';

/**
 * 👑 RealtimeOrchestrator
 * 
 * The single authoritative commander for all realtime events in the application.
 * 
 * Invariants:
 * 1. PERSIST before NOTIFY
 * 2. NOTIFY before ACK
 * 3. Authority for Deduplication and Gap-Resync
 * 4. AUTHORITY OF STATE: Exclusive responsibility for domain-level state (ACKs, Persistence).
 * 
 * Note on Architecture:
 * This Orchestrator handles the User Stream (Domain Events). 
 * UI Hooks handle Room Streams (Ephemeral/Reflection Events).
 * This "Separated Authority" design is intentional: 
 * - Orchestrator = Source of Truth for state changes.
 * - Hooks = Idempotent reflections for UI responsiveness.
 */

export interface RealtimeEvent {
    eventId: string;
    serverTimestamp: number;
    type: string;
    payload: any;
    originClientId?: string;
    isReplay?: boolean;
}

type EventCallback = (event: RealtimeEvent) => void;

const CONTROL_EVENTS = ['connected', 'heartbeat', 'presence', 'presence-update', 'typing', 'chat-typing', 'chat-presence', 'notification', 'error'];

// 🏛️ STATUS_EVENTS: Eventos de ACK/status que NO necesitan persistencia en IndexedDB
// pero SÍ necesitan notificar a los listeners para actualizar UI
const STATUS_EVENTS = ['message.delivered', 'message.read'];

class RealtimeOrchestrator {
    private listeners: Set<EventCallback> = new Set();
    private activeSubscriptions: string[] = [];
    private userId: string | null = null;
    private myClientId: string = getClientId();
    private status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' = 'DISCONNECTED';

    public getHealthStatus() {
        return this.status;
    }

    /**
     * connect() - Subscribes to ssePool and starts orchestration
     */
    async connect(userId: string): Promise<void> {
        this.userId = userId;
        const url = `${API_BASE_URL}/realtime/user/${userId}`;

        if (this.activeSubscriptions.includes(url)) return;

        console.log('[Orchestrator] 🚀 Connecting to user stream...');

        // Subscribe to ssePool with a generic handler that we control
        ssePool.subscribe(url, 'message', (event) => this.processRawEvent(event, 'user'));

        // We also need to catch named events if the backend doesn't use standard Message format
        // But ssePool proxies names to 'message' if requested, or we add listeners here.
        // For robustness, ssePool is built to proxy everything to the registered handlers.

        this.activeSubscriptions.push(url);
    }

    /**
     * processRawEvent() - Entry point for SSE network events
     */
    private async processRawEvent(event: MessageEvent, channel: string) {
        let data: any;
        try {
            data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (e) {
            // console.error('[Orchestrator] ❌ Failed to parse event data');
            return;
        }

        const type = data.type || event.type;

        // 🔍 DEBUG: Log all incoming events to diagnose message.delivered issue
        console.log(`[Orchestrator] 📥 RAW EVENT: type=${type} eventType=${event.type}`);

        return this.processValidatedData(data, type, channel);
    }

    /**
     * processValidatedData() - The Core Engine (Invariante de Oro)
     * Authoritative logic for persistence, notification, and ACK.
     */
    private async processValidatedData(data: any, type: string, channel: string) {
        const { eventId, serverTimestamp, originClientId } = data;

        // 1. Classification & Control Bypass
        if (CONTROL_EVENTS.includes(type)) {
            // console.debug(`[Orchestrator] 🧊 Control event received: ${type}`);
            return;
        }

        // 1.5 🏛️ STATUS_EVENTS: Notificar sin persistir (Ticks de entrega/lectura)
        // Estos eventos son idempotentes y no críticos, solo actualizan UI
        if (STATUS_EVENTS.includes(type)) {
            console.log(`[Orchestrator] 📬 Status event received: ${type}`);
            const statusEvent: RealtimeEvent = {
                eventId: data.eventId || `status_${Date.now()}`,
                serverTimestamp: data.serverTimestamp || Date.now(),
                type,
                payload: data.payload || data,
                originClientId: data.originClientId,
                isReplay: false
            };
            this.listeners.forEach(cb => {
                try { cb(statusEvent); } catch (err) { console.error('[Orchestrator] Listener error:', err); }
            });
            return; // NO persist, NO ack - just notify
        }

        // 2. Contract Verification (ONLY for Domain Events)
        if (!eventId || !serverTimestamp) {
            // SILENT FAIL for system events that might have slipped through CONTROL_EVENTS list
            return;
        }

        // 2. Suppression (Echo & Local Duplication)
        if (originClientId === this.myClientId) {
            // console.debug('[Orchestrator] 🔂 Echo suppressed:', eventId);
            return;
        }

        const alreadyProcessed = await localProcessedLog.isEventProcessed(eventId);
        if (alreadyProcessed) {
            // console.debug('[Orchestrator] 🛡️ Duplicate suppressed (IndexedDB):', eventId);
            return;
        }

        // 3. Persist (INVARIANTE 1)
        try {
            await localProcessedLog.markEventAsProcessed(eventId, serverTimestamp);
            if (this.userId) {
                await localProcessedLog.updateCursor(this.userId, channel, serverTimestamp);
            }
            console.log(`[Orchestrator] ✅ Persisted event: ${eventId}`);
        } catch (err) {
            console.error('[Orchestrator] ❌ Persistence failure. Aborting notify/ack.', err);
            return;
        }

        // 🏛️ ARCHITECTURAL FIX: ACK de mensaje (INVARIANTE 1.5 - Después de PERSIST)
        // SOLO el Orchestrator puede marcar mensajes como delivered
        // Esto reemplaza los 3 ACK paths anteriores (SW, Hook, Backend proactivo)
        if (type === 'new-message' || type === 'chat-update') {
            const message = data.payload?.message || data.message;
            const messageId = message?.id;
            const senderId = message?.sender_id;

            // Solo ACK si: hay messageId, Y el mensaje NO fue enviado por nosotros
            if (messageId && senderId && senderId !== this.userId) {
                this.acknowledgeMessageDelivered(messageId).catch(err => {
                    console.error('[Orchestrator] ⚠️ Message ACK failed for:', messageId, err);
                });
            }
        }

        // 4. Notify Consumers (INVARIANTE 2)
        const realtimeEvent: RealtimeEvent = {
            eventId,
            serverTimestamp,
            type,
            payload: data.payload || data,
            originClientId,
            isReplay: !!data.isReplay
        };

        this.listeners.forEach(cb => {
            try {
                cb(realtimeEvent);
            } catch (err) {
                console.error('[Orchestrator] Error in listener callback:', err);
            }
        });

        // 5. ACK (INVARIANTE 3)
        this.acknowledge(eventId).catch(err => {
            console.error('[Orchestrator] ⚠️ ACK failed for:', eventId, err);
        });
    }

    async acknowledge(eventId: string): Promise<void> {
        // console.debug('[Orchestrator] 📡 Sending ACK:', eventId);
        await fetch(`${API_BASE_URL}/realtime/ack/${eventId}`, {
            method: 'POST',
            headers: { 'X-Client-Id': this.myClientId }
        });
        console.log(`[Orchestrator] 📬 ACK sent for: ${eventId}`);
    }

    /**
     * Este método es el SOLO lugar que puede marcar mensajes como "entregados".
     * Reemplaza los paths de ACK proactivos anteriores.
     * 
     * Invariante:
     * - RealtimeOrchestrator (SSE) y ServiceWorker (Push) son los únicos que reportan "delivered"
     *   al recibir el payload crudo del transporte.
     */
    private async acknowledgeMessageDelivered(messageId: string): Promise<void> {
        if (!this.userId) {
            console.warn('[Orchestrator] Cannot ACK message: No userId');
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/chats/messages/${messageId}/ack-delivered`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Anonymous-Id': this.userId,
                    'X-Client-Id': this.myClientId
                }
            });

            if (response.ok) {
                console.log(`[Orchestrator] 📬📬 Message DELIVERED ACK sent: ${messageId}`);
            } else {
                console.warn(`[Orchestrator] Message ACK failed: ${response.status} for ${messageId}`);
            }
        } catch (err) {
            console.error('[Orchestrator] ⚠️ Message delivery ACK network error:', messageId, err);
        }
    }

    /**
     * resync() - Gap Catchup starting from last processed serverTimestamp
     */
    async resync(): Promise<void> {
        if (!this.userId) return;

        const lastAt = await localProcessedLog.getLastProcessedAt(this.userId, 'user');
        console.log(`[Orchestrator] 🚑 Starting Resync from cursor: ${lastAt}`);

        try {
            const resp = await fetch(`${API_BASE_URL}/realtime/catchup?since=${lastAt}`);

            if (!resp.ok) {
                if (resp.status === 404) {
                    console.warn('[Orchestrator] ⚠️ Catchup API not found (404). Backend might be outdated.');
                }
                throw new Error(`CATCHUP_HTTP_${resp.status}`);
            }

            const events: RealtimeEvent[] = await resp.json();
            console.log(`[Orchestrator] 🚑 Catchup found ${events.length} events.`);

            for (const event of events) {
                // Re-route through authoritative processing
                await this.processValidatedData(event, event.type, 'user');
                console.log(`[Orchestrator] 🚑 Replayed event: ${event.eventId}`);
            }

            this.status = 'HEALTHY';

            // 🧠 MOTOR 4: Notify status change
            dataIntegrityEngine.processEvent({ type: 'realtime:status', status: 'HEALTHY' });
        } catch (err) {
            console.error('[Orchestrator] ❌ Resync failed. Entering DEGRADED mode.', err);
            this.status = 'DEGRADED';

            // 🧠 MOTOR 4: Notify status change
            dataIntegrityEngine.processEvent({ type: 'realtime:status', status: 'DEGRADED' });

            // EMERGENCY FALLBACK: Force invalidate critical queries to ensure consistency
            console.log('[Orchestrator] 🚑 Disaster Recovery: Invalidating critical queries...');
            queryClient.invalidateQueries({ queryKey: ['chats'] });
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        }
    }

    /**
     * shadowReport() - Used during migration Stage 1 to track inconsistencies
     */
    async shadowReport(eventId: string, source: string) {
        const alreadyProcessed = await localProcessedLog.isEventProcessed(eventId);
        if (!alreadyProcessed) {
            console.warn(`[Orchestrator-Shadow] ⚠️ Inconsistency: Hook ${source} processed event ${eventId} but Orchestrator missed it.`);
        } else {
            console.log(`[Orchestrator-Shadow] ✅ Consistency: Hook ${source} and Orchestrator both saw ${eventId}`);
        }
    }

    sleep(reason: string): void {
        console.log(`[Orchestrator] 💤 Sleeping: ${reason}`);
        // Here we could implement throttling or heartbeat slows
        // but WE DO NOT close the SSE pool unless instructed.
    }

    wake(reason: string): void {
        console.log(`[Orchestrator] ⏰ Waking up: ${reason}`);
        this.resync(); // Always resync on wake
    }

    onEvent(cb: EventCallback): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    isEventProcessed(eventId: string): Promise<boolean> {
        return localProcessedLog.isEventProcessed(eventId);
    }

    destroy(): void {
        this.listeners.clear();
        this.activeSubscriptions = [];
        console.log('[Orchestrator] ⚰️ Destroyed');
    }
}

export const realtimeOrchestrator = new RealtimeOrchestrator();
