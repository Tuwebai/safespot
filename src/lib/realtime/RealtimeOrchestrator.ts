import { ssePool } from '../ssePool';
import { localProcessedLog } from './LocalProcessedLog';
import { API_BASE_URL } from '../api';
import { queryClient } from '../queryClient';
import { getClientId } from '../clientId';
import { dataIntegrityEngine } from '@/engine/integrity';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';
import { reportsCache, statsCache, commentsCache } from '../cache-helpers';
import { reportSchema } from '../schemas';
import { upsertInList } from '@/lib/realtime-utils';
import { NOTIFICATIONS_QUERY_KEY } from '@/hooks/queries/useNotificationsQuery';
import { eventAuthorityLog } from './EventAuthorityLog';
import { queryKeys } from '../queryKeys';
import { leaderElection, LeadershipState } from './LeaderElection';

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

const FEED_EVENTS = [
    'report-create',
    'report-update',
    'status-change',
    'report-delete',
    'user-create'
];

class RealtimeOrchestrator {
    private listeners: Set<EventCallback> = new Set();
    private activeSubscriptions: string[] = [];
    private dynamicSubscriptions: Map<string, () => void> = new Map();
    private userId: string | null = null;
    private myClientId: string = getClientId();
    private status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' = 'DISCONNECTED';
    private syncChannel: BroadcastChannel;

    constructor() {
        this.syncChannel = new BroadcastChannel('safespot-m11-events');
        this.syncChannel.onmessage = (e) => this.handleSyncEvent(e.data);

        // 👑 Leadership Failover handler
        leaderElection.onChange((state) => {
            if (state === LeadershipState.LEADING) {
                console.log('[Orchestrator] 👑 Leadership assumed. Waking up context...');
                this.wake('leadership_assumed');
            } else {
                // Too noisy
                console.debug('[Orchestrator] 👥 Following active leader.');
            }
        });
    }

    // 🚥 PHASE D TELEMETRY
    private stats = {
        received: 0,
        processed: 0,
        dropped: 0
    };

    public getHealthStatus() {
        return this.status;
    }

    /**
     * connect() - Subscribes to ssePool and starts orchestration
     */
    async connect(userId: string): Promise<void> {
        this.userId = userId;
        const userUrl = `${API_BASE_URL}/realtime/user/${userId}`;
        const feedUrl = `${API_BASE_URL}/realtime/feed`;

        // 1. User Stream (Domain Events: Chats, Notifications, Presence)
        if (!this.activeSubscriptions.includes(userUrl)) {
            console.debug('[Orchestrator] 🚀 Connecting to user stream...');
            ssePool.subscribe(userUrl, 'message', (event) => this.processRawEvent(event, 'user'));
            ssePool.subscribe(userUrl, 'notification', (event) => this.processRawEvent(event, 'user'));
            ssePool.subscribe(userUrl, 'presence-update', (event) => this.processRawEvent(event, 'user'));
            this.activeSubscriptions.push(userUrl);
        }

        // 2. Global Feed Stream (Community Events: Reports, Stats)
        if (!this.activeSubscriptions.includes(feedUrl)) {
            console.debug('[Orchestrator] 🌐 Connecting to global feed...');
            FEED_EVENTS.forEach(eventName => {
                ssePool.subscribe(feedUrl, eventName, (event) => this.processRawEvent(event, 'feed'));
            });
            this.activeSubscriptions.push(feedUrl);
        }
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
        const traceId = (event as any).traceId || telemetry.getTraceId();

        // 📡 MOTOR 8: Propagate Root Trace
        telemetry.emit({
            engine: 'Orchestrator',
            severity: TelemetrySeverity.DEBUG,
            traceId,
            payload: { action: 'raw_event_processing_start', type, channel }
        });

        return telemetry.runInContext(traceId, () => this.processValidatedData(data, type, channel));
    }

    /**
     * processValidatedData() - The Core Engine (Invariante de Oro)
     * Authoritative logic for persistence, notification, and ACK.
     */
    private async processValidatedData(data: any, type: string, channel: string) {
        const { eventId, serverTimestamp, originClientId } = data;

        // 1. Classification & Control Bypass
        if (CONTROL_EVENTS.includes(type)) {
            // 📡 MOTOR 8: Signal Control Event Bypass
            telemetry.emit({
                engine: 'Orchestrator',
                severity: TelemetrySeverity.DEBUG,
                payload: {
                    action: 'event_discarded_by_filter',
                    type,
                    reason: 'control_event',
                    context: { route: window.location.pathname }
                }
            });
            return;
        }

        // 1.5 🏛️ STATUS_EVENTS: Notificar sin persistir (Ticks de entrega/lectura)
        // Estos eventos son idempotentes y no críticos, solo actualizan UI
        if (STATUS_EVENTS.includes(type)) {
            console.debug(`[Orchestrator] 📬 Status event received: ${type}`);
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
            // 📡 MOTOR 8: Signal Invalid Contract
            telemetry.emit({
                engine: 'Orchestrator',
                severity: TelemetrySeverity.WARN,
                payload: { action: 'event_discarded_by_filter', type, reason: 'missing_contract_fields' }
            });
            return;
        }

        // 2. Suppression (Authority Log + Echo Suppression)
        this.stats.received++;

        if (!eventAuthorityLog.shouldProcess(eventId, originClientId, this.myClientId)) {
            this.stats.dropped++;

            return;
        }

        // 2.5 Secondary check (IndexedDB) - Rare but safe for cold boot
        const alreadyInIDB = await localProcessedLog.isEventProcessed(eventId);
        if (alreadyInIDB) {
            this.stats.dropped++;
            eventAuthorityLog.record({
                eventId,
                type,
                domain: (channel.startsWith('social') ? 'social' : channel) as any,
                serverTimestamp,
                processedAt: Date.now(),
                originClientId: originClientId || 'unknown'
            });
            return;
        }

        // 3. Persist (INVARIANTE 1) - ONLY LEADERS PERSIST TO DB
        if (leaderElection.isLeader()) {
            try {
                await localProcessedLog.markEventAsProcessed(eventId, serverTimestamp);
                if (this.userId) {
                    await localProcessedLog.updateCursor(this.userId, channel, serverTimestamp);
                }
                console.debug(`[Orchestrator] ✅ Persisted event: ${eventId}`);

                // 📡 MOTOR 8: Trace Persistence
                telemetry.emit({
                    engine: 'Orchestrator',
                    severity: TelemetrySeverity.DEBUG,
                    payload: { action: 'event_persisted', eventId, channel }
                });
            } catch (err) {
                console.error('[Orchestrator] ❌ Persistence failure. Aborting notify/ack.', err);
                return;
            }
        }

        // 1.1 COMMUNITY FEED HANDLER (New Authority)
        if (channel === 'feed') {
            await this.processFeedDomainLogic(type, data);
        }

        // 1.2 USER DOMAIN HANDLER (Centralized Authority)
        if (channel === 'user') {
            await this.processUserDomainLogic(type, data);
        }

        // 1.3 SOCIAL DOMAIN HANDLER (Dynamic Authority)
        if (channel.startsWith('social:')) {
            await this.processSocialDomainLogic(type, data);
        }

        // 🏛️ ARCHITECTURAL FIX: ACK de mensaje (INVARIANTE 1.5 - Después de PERSIST)
        // SOLO el Orchestrator puede marcar mensajes como delivered
        // Motor 11: SOLO el líder envía ACKs al backend
        if (leaderElection.isLeader() && (type === 'new-message' || type === 'chat-update')) {
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
        // Motor 11 Invariant: Listeners called in followers must be idempotent 
        // and without persistent side effects (e.g., no duplicate sounds or toasts).
        // The View Reconciliation Engine (Motor 10) governs UI state.
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

        // 5. ACK & Record Authority (INVARIANTE 3)
        // Motor 11: SOLO el líder envía ACKs de evento
        if (leaderElection.isLeader()) {
            await this.acknowledge(eventId);

            // 🛰️ MOTOR 11: Shared Broadcast to Followers
            this.syncChannel.postMessage({ data, type, channel });
        }

        eventAuthorityLog.record({
            eventId,
            type,
            domain: (channel.startsWith('social') ? 'social' : channel) as any,
            serverTimestamp,
            processedAt: Date.now(),
            originClientId: originClientId || 'unknown'
        });

        this.stats.processed++;
    }

    /**
     * handleSyncEvent() - Entry for events received from the Leader
     */
    private handleSyncEvent(sync: { data: any, type: string, channel: string }) {
        if (leaderElection.isLeader()) return; // Leaders ignore their own (or others') broadcast

        console.debug(`[Orchestrator] 🛰️ Processing sync event from leader: ${sync.type}`);
        this.processValidatedData(sync.data, sync.type, sync.channel);
    }

    /**
     * processSocialDomainLogic() - Authoritative state changes for comments and likes
     */
    private async processSocialDomainLogic(type: string, data: any) {
        const payload = data.payload || data;
        const reportId = payload.reportId || payload.report_id;

        try {
            switch (type) {
                case 'new-comment': {
                    if (payload.partial || payload.comment) {
                        commentsCache.append(queryClient, payload.partial || payload.comment);
                    }
                    break;
                }
                case 'comment-update': {
                    if (payload.isLikeDelta) {
                        commentsCache.applyLikeDelta(queryClient, payload.id, payload.delta);
                    } else {
                        commentsCache.patch(queryClient, payload.id, payload.partial || payload.comment);
                    }
                    break;
                }
                case 'comment-delete': {
                    if (payload.id && reportId) {
                        commentsCache.remove(queryClient, payload.id, reportId);
                    }
                    break;
                }
                case 'report-update': {
                    if (payload.id) {
                        reportsCache.patch(queryClient, payload.id, payload.partial);
                    }
                    break;
                }
            }
        } catch (err) {
            console.error(`[Orchestrator] ❌ Error applying social logic for ${type}:`, err);
        }
    }

    /**
     * processUserDomainLogic() - Authoritative state changes for the personal user stream
     */
    private async processUserDomainLogic(type: string, data: any) {
        const payload = data.payload || data;

        try {
            switch (type) {
                case 'notification': {
                    if (payload.notification) {
                        upsertInList(queryClient, NOTIFICATIONS_QUERY_KEY, payload.notification);
                    }
                    if (payload.type === 'notifications-read-all') {
                        queryClient.setQueryData(['notifications', 'list', this.userId], (old: any) =>
                            Array.isArray(old) ? old.map((n: any) => ({ ...n, is_read: true })) : []
                        );
                    }
                    if (payload.type === 'notifications-deleted-all') {
                        queryClient.setQueryData(['notifications', 'list', this.userId], []);
                    }
                    if (payload.type === 'follow') {
                        queryClient.invalidateQueries({ queryKey: ['users', 'public', 'profile'] });
                    }
                    if (payload.type === 'achievement' && payload.notification) {
                        const badgeId = payload.notification.code || payload.notification.id;
                        if (this.userId && badgeId) {
                            // 🏅 Idempotencia Semántica (Fase C½ / Hardening de Dominio):
                            // Protección de negocio para evitar duplicados en la UX incluso si el eventId varía.
                            if (eventAuthorityLog.isBadgeProcessed(this.userId, badgeId)) {
                                console.debug(`[Orchestrator] 🛡️ Semantic duplicate suppressed (Badge): ${badgeId}`);
                                return;
                            }

                            // Registrar la insignia en la autoridad para futuras deduplicaciones
                            eventAuthorityLog.record({
                                eventId: data.eventId,
                                type: data.type,
                                domain: 'user',
                                serverTimestamp: data.serverTimestamp,
                                processedAt: Date.now(),
                                originClientId: data.originClientId || 'unknown'
                            }, `badge_${this.userId}_${badgeId}`);
                        }

                        // 🏅 SOCIAL SSOT: Update gamification cache and profile
                        queryClient.setQueryData(queryKeys.gamification.summary, (old: any) => {
                            if (!old) return old;
                            return {
                                ...old,
                                newBadges: [...(old.newBadges || []), payload.notification]
                            };
                        });
                        // Points/Level sync
                        queryClient.invalidateQueries({ queryKey: queryKeys.user.profile });
                    }
                    break;
                }
                case 'presence-update': {
                    if (payload.userId) {
                        queryClient.setQueryData(['users', 'presence', payload.userId], payload.partial || payload);
                    }
                    break;
                }
            }
        } catch (err) {
            console.error(`[Orchestrator] ❌ Error applying user logic for ${type}:`, err);
        }
    }

    /**
     * processFeedDomainLogic() - Authoritative state changes for the global feed
     */
    private async processFeedDomainLogic(type: string, data: any) {
        const payload = data.payload || data;

        try {
            switch (type) {
                case 'report-create': {
                    const parsed = reportSchema.safeParse(payload.partial || payload);
                    if (parsed.success) {
                        reportsCache.prepend(queryClient, parsed.data);
                        statsCache.applyReportCreate(queryClient, parsed.data.category, parsed.data.status);
                    }
                    break;
                }
                case 'report-update': {
                    if (payload.isLikeDelta) {
                        reportsCache.applyLikeDelta(queryClient, payload.id, payload.delta);
                    } else if (payload.isCommentDelta) {
                        reportsCache.applyCommentDelta(queryClient, payload.id, payload.delta);
                    } else {
                        const parsed = reportSchema.partial().safeParse(payload.partial || payload);
                        if (parsed.success) {
                            reportsCache.patch(queryClient, payload.id, parsed.data);
                        }
                    }
                    break;
                }
                case 'status-change': {
                    statsCache.applyStatusChange(queryClient, payload.prevStatus, payload.newStatus);
                    reportsCache.patch(queryClient, payload.id, { status: payload.newStatus });
                    break;
                }
                case 'report-delete': {
                    reportsCache.remove(queryClient, payload.id);
                    if (payload.category) {
                        statsCache.applyReportDelete(queryClient, payload.category, payload.status);
                    }
                    break;
                }
                case 'user-create': {
                    statsCache.incrementUsers(queryClient);
                    break;
                }
            }
        } catch (err) {
            console.error(`[Orchestrator] ❌ Error applying feed logic for ${type}:`, err);
        }
    }

    async acknowledge(eventId: string): Promise<void> {
        // ... (rest same, omitting unchanged)
        // console.debug('[Orchestrator] 📡 Sending ACK:', eventId);
        await fetch(`${API_BASE_URL}/realtime/ack/${eventId}`, {
            method: 'POST',
            headers: { 'X-Client-Id': this.myClientId }
        });
        console.debug(`[Orchestrator] 📬 ACK sent for: ${eventId}`);
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
                console.debug(`[Orchestrator] 📬📬 Message DELIVERED ACK sent: ${messageId}`);
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
        console.debug(`[Orchestrator] 🚑 Starting Resync from cursor: ${lastAt}`);

        try {
            const resp = await fetch(`${API_BASE_URL}/realtime/catchup?since=${lastAt}`);

            if (!resp.ok) {
                if (resp.status === 404) {
                    console.warn('[Orchestrator] ⚠️ Catchup API not found (404). Backend might be outdated.');
                }
                throw new Error(`CATCHUP_HTTP_${resp.status}`);
            }

            const events: RealtimeEvent[] = await resp.json();
            console.debug(`[Orchestrator] 🚑 Catchup found ${events.length} events.`);

            for (const event of events) {
                // Re-route through authoritative processing
                await this.processValidatedData(event, event.type, 'user');
                console.debug(`[Orchestrator] 🚑 Replayed event: ${event.eventId}`);
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
            console.debug('[Orchestrator] 🚑 Disaster Recovery: Invalidating critical queries...');
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
            console.debug(`[Orchestrator-Shadow] ✅ Consistency: Hook ${source} and Orchestrator both saw ${eventId}`);
        }
    }

    sleep(reason: string): void {
        console.debug(`[Orchestrator] 💤 Sleeping: ${reason}`);
        // Here we could implement throttling or heartbeat slows
        // but WE DO NOT close the SSE pool unless instructed.
    }

    wake(reason: string): void {
        console.debug(`[Orchestrator] ⏰ Waking up: ${reason}`);
        this.resync(); // Always resync on wake
    }

    onEvent(cb: EventCallback): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    isEventProcessed(eventId: string): Promise<boolean> {
        return localProcessedLog.isEventProcessed(eventId);
    }

    /**
     * watchReportComments() - Dyamic subscription for a report's social feed
     */
    watchReportComments(reportId: string): void {
        const url = `${API_BASE_URL}/realtime/comments/${reportId}`;
        const channelId = `social:${reportId}`;

        if (this.dynamicSubscriptions.has(channelId)) return;

        console.debug(`[Orchestrator] 👁️ Watching social feed for report: ${reportId}`);

        const unsubNew = ssePool.subscribe(url, 'new-comment', (event) => this.processRawEvent(event, channelId));
        const unsubUpdate = ssePool.subscribe(url, 'comment-update', (event) => this.processRawEvent(event, channelId));
        const unsubDelete = ssePool.subscribe(url, 'comment-delete', (event) => this.processRawEvent(event, channelId));
        const unsubReport = ssePool.subscribe(url, 'report-update', (event) => this.processRawEvent(event, channelId));

        this.dynamicSubscriptions.set(channelId, () => {
            unsubNew();
            unsubUpdate();
            unsubDelete();
            unsubReport();
        });
    }

    /**
     * unwatchReportComments() - Cleanup dynamic social subscription
     */
    unwatchReportComments(reportId: string): void {
        const channelId = `social:${reportId}`;
        const unsub = this.dynamicSubscriptions.get(channelId);
        if (unsub) {
            console.debug(`[Orchestrator] 🙈 Unwatching social feed for report: ${reportId}`);
            unsub();
            this.dynamicSubscriptions.delete(channelId);
        }
    }

    destroy(): void {
        this.listeners.clear();
        this.activeSubscriptions = [];
        this.dynamicSubscriptions.forEach(unsub => unsub());
        this.dynamicSubscriptions.clear();
        console.debug('[Orchestrator] ⚰️ Destroyed');
    }
}

export const realtimeOrchestrator = new RealtimeOrchestrator();
