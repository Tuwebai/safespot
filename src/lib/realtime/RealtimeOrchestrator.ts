import { ssePool } from '../ssePool';
import { localProcessedLog } from './LocalProcessedLog';
import { API_BASE_URL } from '../api';
import { queryClient } from '../queryClient';
import { getClientId } from '../clientId';

/**
 * 👑 RealtimeOrchestrator
 * 
 * The single authoritative commander for all realtime events in the application.
 * 
 * Invariants:
 * 1. PERSIST before NOTIFY
 * 2. NOTIFY before ACK
 * 3. Authority for Deduplication and Gap-Resync
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
        } catch (err) {
            console.error('[Orchestrator] ❌ Resync failed. Entering DEGRADED mode.', err);
            this.status = 'DEGRADED';

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
