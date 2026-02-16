import { ssePool } from '../ssePool';
import { localProcessedLog } from './LocalProcessedLog';
import { API_BASE_URL } from '../api';
import { sessionAuthority } from '@/engine/session/SessionAuthority';
import { queryClient } from '../queryClient';
import { getClientId } from '../clientId';
import { dataIntegrityEngine } from '@/engine/integrity';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';
import { reportsCache, statsCache, commentsCache } from '../cache-helpers';
import { reportSchema, Comment } from '../schemas';
import { transformComment, type RawComment } from '../adapters';
import { getAvatarUrl } from '../avatar';
import { upsertInList } from '@/lib/realtime-utils';
// NOTIFICATIONS_QUERY_KEY dinámico - debe incluir anonymousId para consistencia
const getNotificationsQueryKey = (anonymousId: string | null): string[] => 
    anonymousId ? ['notifications', 'list', anonymousId] : ['notifications', 'list'];
import { eventAuthorityLog } from './EventAuthorityLog';
import { queryKeys } from '../queryKeys';
import { leaderElection, LeadershipState } from './LeaderElection';
// 🏛️ SAFE MODE: Importar nuevos tipos de eventos
import type { 
    RealtimeEvent as TypedRealtimeEvent,
    TypedRealtimeEvent as TypedEventUnion,
    UntypedRealtimeEvent,
    RealtimeEventLegacy
} from './eventTypes';
export type { TypedRealtimeEvent, TypedEventUnion, UntypedRealtimeEvent };

// 🏛️ SAFE MODE: Type aliases para datos de evento durante migración
type EventData = Record<string, unknown>;
/** @deprecated Usar tipos específicos de eventTypes.ts */
type LegacyPayload = Record<string, unknown> & { [key: string]: unknown };

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

/**
 * 🏛️ SAFE MODE: Interfaz de evento con payload unknown (type-safe)
 * 
 * ANTES: payload: any (permite cualquier acceso sin verificación)
 * AHORA: payload: unknown (requiere type guards o narrowing)
 * 
 * Para acceder al payload tipado:
 * 1. Usar isTypedEvent(event) para eventos conocidos
 * 2. Usar type guards específicos: isNewMessageEvent(), etc.
 * 3. Cast manual con verificación para casos edge
 */
export interface RealtimeEvent {
    eventId: string;
    serverTimestamp: number;
    type: string;
    payload: unknown;
    originClientId?: string;
    isReplay?: boolean;
}

/**
 * @deprecated Usar RealtimeEvent con type guards en su lugar
 * Tipo legacy para compatibilidad durante transición
 */
export type RealtimeEventAny = RealtimeEventLegacy;

type EventCallback = (event: RealtimeEvent) => void;

/**
 * PROTOCOL_EVENTS: Eventos de infraestructura del canal SSE.
 * Estos eventos NO representan cambios de dominio, sino metadatos del canal
 * (heartbeats, estado de conexión, indicadores de escritura, etc.).
 * Se descartan del pipeline de dominio porque no requieren persistencia ni lógica de negocio.
 * 
 * ⚠️ NUNCA agregar eventos de dominio aquí (ej: 'notification', 'message', 'report-create').
 * Esos deben pasar a processValidatedData() para su manejo apropiado.
 */
const PROTOCOL_EVENTS = [
  'connected',
  'heartbeat',
  'presence',
  'presence-update',
  'typing',
  'chat-typing',
  'chat-presence',
  'error'
];

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

const CHAT_EVENTS = [
    'new-message',
    'typing',
    'message.read',
    'message.delivered',
    'presence',
    'chat-update',
    'chat-rollback',
    'message-deleted',
    'message-reaction',
    'message-pinned'
];

// 🏛️ ENTERPRISE: Circuit Breaker State
enum CircuitState { CLOSED = 'CLOSED', OPEN = 'OPEN', HALF_OPEN = 'HALF_OPEN' }

class RealtimeOrchestrator {
    private listeners: Set<EventCallback> = new Set();
    private activeSubscriptions: string[] = [];
    private dynamicSubscriptions: Map<string, () => void> = new Map();
    private userId: string | null = null;
    private myClientId: string = getClientId();
    private status: 'HEALTHY' | 'DEGRADED' | 'DISCONNECTED' = 'DISCONNECTED';
    private syncChannel!: BroadcastChannel; // Definite assignment via constructor

    // 🏛️ ENTERPRISE: Circuit Breaker (previene cascada de fallos)
    private circuitState: CircuitState = CircuitState.CLOSED;
    private circuitFailureCount: number = 0;
    private readonly CIRCUIT_THRESHOLD = 5;
    private readonly CIRCUIT_TIMEOUT_MS = 30000;
    private circuitResetTimeout: ReturnType<typeof setTimeout> | null = null;

    // 📊 Stats básicos (suficiente para volumen de SafeSpot)
    private stats = {
        received: 0,
        processed: 0,
        dropped: 0,
        failed: 0,
    };

    // 🛡️ MEM-ROOT-001: Flag para prevenir inicialización múltiple
    private isInitialized = false;

    constructor() {
        // 🛡️ MEM-ROOT-001: SSE Safety Guard
        // Prevent multiple instances during HMR or component remounts
        const win = window as Window & { __REALTIME_ORCHESTRATOR_INSTANCE__?: RealtimeOrchestrator };
        if (win.__REALTIME_ORCHESTRATOR_INSTANCE__) {
            console.warn('[Orchestrator] ⚠️ Instance already exists. Use getInstance() or realtimeOrchestrator export.');
            return;
        }
        win.__REALTIME_ORCHESTRATOR_INSTANCE__ = this;

        this.initialize();
    }

    /**
     * 🛡️ MEM-ROOT-001: Inicialización lazy para evitar doble setup
     */
    private initialize(): void {
        if (this.isInitialized) return;
        this.isInitialized = true;

        this.syncChannel = new BroadcastChannel('safespot-m11-events');
        this.syncChannel.onmessage = (e) => this.handleSyncEvent(e.data);

        // 👑 Leadership Failover handler
        leaderElection.onChange((state) => {
            if (state === LeadershipState.LEADING) {
                this.wake('leadership_assumed');
            }
        });

        // 🚑 SSE Wake listener (Idle Recovery)
        if (typeof window !== 'undefined') {
            window.addEventListener('safespot:sse_wake', ((e: CustomEvent<{ url: string }>) => {
                console.log(`[Orchestrator] 🚑 SSE Wake detected for ${e.detail?.url}. Triggering catchup...`);
                this.resync().catch(err => {
                    telemetry.emit({
                        engine: 'Orchestrator',
                        severity: TelemetrySeverity.ERROR,
                        payload: { action: 'wake_resync_failed', error: err.message }
                    });
                });
            }) as EventListener);
        }
    }

    /**
     * connect() - Subscribes to ssePool and starts orchestration
     */
    async connect(userId: string): Promise<void> {
        this.userId = userId;
        // EventSource cannot send Authorization headers, so JWT goes in query for realtime endpoints.
        const anonymousId = sessionAuthority.getAnonymousId() || userId;
        const jwt = sessionAuthority.getToken()?.jwt;
        const authQuery = jwt ? `&token=${encodeURIComponent(jwt)}` : '';
        const userUrl = `${API_BASE_URL}/realtime/user/${userId}?anonymousId=${anonymousId}${authQuery}`;
        const feedUrl = `${API_BASE_URL}/realtime/feed?anonymousId=${anonymousId}${authQuery}`;

        // 1. User Stream (Domain Events: Chats, Notifications, Presence) - requires JWT
        if (jwt && !this.activeSubscriptions.includes(userUrl)) {
            ssePool.subscribe(userUrl, 'message', (event) => this.processRawEvent(event, 'user'));
            ssePool.subscribe(userUrl, 'message.delivered', (event) => this.processRawEvent(event, 'user'));
            ssePool.subscribe(userUrl, 'message.read', (event) => this.processRawEvent(event, 'user'));
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
        let rawData: unknown;
        try {
            rawData = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        } catch (e) {
            // console.error('[Orchestrator] ❌ Failed to parse event data');
            return;
        }

        // 🏛️ SAFE MODE: Validar que rawData es un objeto antes de acceder a propiedades
        if (typeof rawData !== 'object' || rawData === null) {
            return;
        }
        
        const data = rawData as Record<string, unknown>;
        const type = (data.type as string) || event.type;
        
        // Message-related events processed silently in production
        
        // 🏛️ WHATSAPP-GRADE: ACK inmediato para mensajes nuevos
        // Esto debe hacerse ANTES de cualquier procesamiento que pueda fallar
        // Soporta tanto 'new-message' (room stream) como 'chat-update' (user stream)
        if ((type === 'new-message' || type === 'chat-update') && leaderElection.isLeader()) {
            // 🏛️ SAFE MODE: Type assertion para acceso a propiedades dinámicas
            const payload = (data.partial || data.payload || data) as Record<string, unknown>;
            const message = (payload.message || (payload.id && !payload.action ? payload : null)) as { id: string; sender_id: string } | null;
            
            if (message?.id && message.sender_id && message.sender_id !== this.userId) {
                this.acknowledgeMessageDelivered(message.id).catch(() => {});
            }
        }
        
        const traceId = (data.traceId as string) || telemetry.getTraceId();

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
     * 
     * 🏛️ SAFE MODE: data ahora es unknown, requiere type narrowing
     */
    private async processValidatedData(rawData: unknown, type: string, channel: string) {
        // 🏛️ SAFE MODE: Type assertion a Record para acceso controlado a propiedades
        const data = rawData as Record<string, unknown>;
        const eventId = data.eventId as string;
        const serverTimestamp = data.serverTimestamp as number;
        const originClientId = data.originClientId as string | undefined;
        const isSocialChannel = channel.startsWith('social');
        
        // 🏛️ ENTERPRISE: Circuit breaker check
        if (this.isCircuitOpen()) {
            console.warn(`[Orchestrator] 🔴 Circuit open, dropping event: ${eventId}`);
            this.stats.dropped++;
            return;
        }

        // 1. Classification & Control Bypass
        if (PROTOCOL_EVENTS.includes(type)) {
            // 📡 MOTOR 8: Signal Control Event Bypass
            telemetry.emit({
                engine: 'Orchestrator',
                severity: TelemetrySeverity.DEBUG,
                payload: {
                    action: 'event_discarded_by_filter',
                    type,
                    reason: 'protocol_event',
                    context: { route: window.location.pathname }
                }
            });
            return;
        }

        // 1.5 🏛️ STATUS_EVENTS: Notificar sin persistir (Ticks de entrega/lectura)
        // Estos eventos son idempotentes y no críticos, solo actualizan UI
        if (STATUS_EVENTS.includes(type)) {
            // 🏛️ SAFE MODE: Type assertions para extraer propiedades de evento
            const statusEvent: RealtimeEvent = {
                eventId: (data.eventId as string) || `status_${Date.now()}`,
                serverTimestamp: (data.serverTimestamp as number) || Date.now(),
                type,
                payload: data.partial || data.payload || data,
                originClientId: data.originClientId as string | undefined,
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
        if (!isSocialChannel) {
            const alreadyInIDB = await localProcessedLog.isEventProcessed(eventId);
            if (alreadyInIDB) {
                this.stats.dropped++;
                eventAuthorityLog.record({
                    eventId,
                    type,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    domain: (channel.startsWith('social') ? 'social' : channel) as 'feed' | 'user' | 'system' | 'social',
                    serverTimestamp,
                    processedAt: Date.now(),
                    originClientId: originClientId || 'unknown'
                });
                return;
            }
        }

        // 3. Persist (INVARIANTE 1) - ONLY LEADERS PERSIST TO DB
        if (leaderElection.isLeader()) {
            try {
                if (isSocialChannel) {
                    void localProcessedLog.markEventAsProcessed(eventId, serverTimestamp);
                    if (this.userId) {
                        void localProcessedLog.updateCursor(this.userId, channel, serverTimestamp);
                    }
                } else {
                    await localProcessedLog.markEventAsProcessed(eventId, serverTimestamp);
                    if (this.userId) {
                        await localProcessedLog.updateCursor(this.userId, channel, serverTimestamp);
                    }
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

        // 📡 MOTOR 9: Automatic Routing by Type (Domain Discovery)
        let effectiveChannel = channel;
        if (!effectiveChannel || effectiveChannel === 'user' || effectiveChannel === 'system') {
            if (FEED_EVENTS.includes(type)) effectiveChannel = 'feed';
            else if (CHAT_EVENTS.includes(type)) effectiveChannel = 'chat';
            else if (type.startsWith('comment-') || type === 'new-comment') effectiveChannel = 'social';
            else effectiveChannel = 'user';
        }

        // 1.1 COMMUNITY FEED HANDLER (New Authority)
        if (effectiveChannel === 'feed') {
            await this.processFeedDomainLogic(type, data);
        }

        // 1.2 USER DOMAIN HANDLER (Centralized Authority)
        if (effectiveChannel === 'user') {
            await this.processUserDomainLogic(type, data);
        }

        // 1.3 CHAT DOMAIN HANDLER (Atomic Authority)
        if (effectiveChannel === 'chat') {
            await this.processChatDomainLogic(type, data);
        }

        // 1.4 SOCIAL DOMAIN HANDLER (Dynamic Authority)
        if (effectiveChannel.startsWith('social')) {
            await this.processSocialDomainLogic(type, data);
        }

        // 🏛️ WHATSAPP-GRADE DELIVERY RECEIPTS
        // Segundo tick = mensaje entregado al dispositivo del receptor
        // Esto ocurre en dos escenarios:
        // 1. App cerrada/background: Push llega → SW envía ACK
        // 2. App abierta (SSE): Orchestrator recibe mensaje → envía ACK
        if (leaderElection.isLeader() && (type === 'new-message' || type === 'chat-update')) {
            // El mensaje puede venir en diferentes estructuras:
            // - new-message: data.message o data.payload.message
            // - chat-update: data.partial.message
            const payload = (data.partial || data.payload || data) as EventData;
            const message = (payload.message as EventData) || (data.message as EventData) || 
                ((payload.id && !payload.action) ? payload : null);

            // Solo ACK si:
            // - Es un mensaje real (no signal de typing/read)
            // - El mensaje no es mío (no ACK mis propios mensajes)
            const isDeliverable = message?.id
                && !payload.action
                && message.sender_id
                && message.sender_id !== this.userId;

            if (isDeliverable && message?.id) {
                this.acknowledgeMessageDelivered(message.id as string).catch(() => {
                    // Silently fail - no crítico
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
                this.recordFailure();
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            domain: (channel.startsWith('social') ? 'social' : channel) as 'feed' | 'user' | 'system' | 'social',
            serverTimestamp,
            processedAt: Date.now(),
            originClientId: originClientId || 'unknown'
        });

        this.stats.processed++;
        this.recordSuccess(); // 🏛️ Cierra circuit breaker si estaba HALF_OPEN
    }

    /**
     * handleSyncEvent() - Entry for events received from the Leader
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private handleSyncEvent(sync: { data: unknown, type: string, channel: string }) {
        if (leaderElection.isLeader()) return; // Leaders ignore their own (or others') broadcast

        console.debug(`[Orchestrator] 🛰️ Processing sync event from leader: ${sync.type}`);
        this.processValidatedData(sync.data, sync.type, sync.channel);
    }

    /**
     * processSocialDomainLogic() - Authoritative state changes for comments and likes
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async processSocialDomainLogic(type: string, data: Record<string, unknown>) {
        const payload = (data.partial || data.payload || data) as LegacyPayload;
        const id = data.id || payload.id;
        const reportId = payload.reportId || payload.report_id as string;

        try {
            switch (type) {
                case 'new-comment': {
                    const commentPayload = payload.comment || payload;
                    if (!commentPayload) return;

                    let normalizedComment: Comment;
                    try {
                        normalizedComment = ('author' in (commentPayload as Record<string, unknown>))
                            ? (commentPayload as unknown as Comment)
                            : transformComment(commentPayload as unknown as RawComment);
                    } catch {
                        // Fallback defensivo para payloads legacy parciales.
                        normalizedComment = commentPayload as unknown as Comment;
                    }

                    // Hardening de contrato UI: asegurar author completo para render inmediato.
                    const authorId =
                        normalizedComment?.author?.id ||
                        (commentPayload as { anonymous_id?: string })?.anonymous_id;
                    if (authorId) {
                        normalizedComment = {
                            ...normalizedComment,
                            author: {
                                id: authorId,
                                alias: normalizedComment.author?.alias || authorId.slice(0, 8),
                                avatarUrl: normalizedComment.author?.avatarUrl || getAvatarUrl(authorId),
                                isAuthor: normalizedComment.author?.isAuthor ?? false
                            }
                        };
                    }

                    const commentId = normalizedComment.id;
                    const reportIdComment = normalizedComment.report_id;
                    if (!commentId || !reportIdComment) return;

                    // ✅ ENTERPRISE FIX: Deduplicación determinística basada en LISTA
                    // Principio: La fuente de verdad es el estado de la lista, no solo el detail cache
                    // Problema: Si comentario optimista está en lista pero sin detail query → doble delta
                    // Solución: Verificar contra la lista normalizada primero

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const list = queryClient.getQueryData<any>(
                        queryKeys.comments.byReport(reportIdComment)
                    );

                    // Normalizar lista (puede ser array directo o { comments: [...] })
                    const normalizedList = Array.isArray(list)
                        ? list
                        : (list?.comments || []);

                    const alreadyInList = normalizedList.includes(commentId);

                    if (alreadyInList) {
                        // Ya existe en la lista → verificar si es optimista para reconciliar
                        const existing = queryClient.getQueryData<Comment>(
                            queryKeys.comments.detail(commentId)
                        );

                        if (existing?.is_optimistic) {
                            // Reconciliar optimista con datos reales (sin delta)
                            commentsCache.store(queryClient, normalizedComment);
                        }
                        // Si no es optimista o no existe detail → skip (ya fue procesado)
                        return;
                    }

                    // No existe en lista → es comentario realmente nuevo.
                    // Mantener orden consistente con GET /comments (más reciente primero).
                    commentsCache.prepend(queryClient, normalizedComment);
                    break;
                }
                case 'comment-update': {
                    const commentId = (id || payload.commentId || (payload.comment as LegacyPayload)?.id) as string;
                    if (!commentId) return;

                    if (data.isLikeDelta || payload.isLikeDelta) {
                        commentsCache.applyLikeDelta(queryClient, commentId, (data.delta || payload.delta) as number);
                    } else {
                        const patch = payload.comment || payload;
                        commentsCache.patch(queryClient, commentId, patch as Record<string, unknown>);
                    }
                    break;
                }
                case 'comment-delete': {
                    const commentIdDelete = (id || payload.commentId) as string;
                    const finalReportId = (reportId || payload.reportId || payload.report_id) as string;
                    if (commentIdDelete && finalReportId) {
                        commentsCache.remove(queryClient, commentIdDelete, finalReportId);
                    }
                    break;
                }
                case 'report-update': {
                    const updateId = id as string;
                    if (updateId) {
                        reportsCache.patch(queryClient, updateId, payload as Record<string, unknown>);
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async processUserDomainLogic(type: string, data: Record<string, unknown>) {
        const payload = (data.payload || data) as LegacyPayload;
        // 🏛️ ENTERPRISE FIX: Query key consistente con useNotificationsQuery
        const notificationsQueryKey = getNotificationsQueryKey(this.userId);

        try {
            switch (type) {
                case 'notification': {
                    const notifPayload = payload.notification as LegacyPayload & { id: string };
                    if (notifPayload?.id) {
                        upsertInList(queryClient, notificationsQueryKey, notifPayload);
                    }
                    if (payload.type === 'notifications-read-all') {
                        type NotificationItem = { is_read: boolean; [key: string]: unknown };
                        queryClient.setQueryData<NotificationItem[]>(notificationsQueryKey, (old) =>
                            Array.isArray(old) ? old.map((n) => ({ ...n, is_read: true })) : []
                        );
                    }
                    if (payload.type === 'notifications-deleted-all') {
                        queryClient.setQueryData(notificationsQueryKey, []);
                    }
                    if (payload.type === 'follow') {
                        queryClient.invalidateQueries({ queryKey: ['users', 'public', 'profile'] });
                    }
                    if (payload.type === 'achievement' && notifPayload) {
                        const badgeId = (notifPayload.code || notifPayload.id) as string;
                        if (this.userId && badgeId) {
                            // 🏅 Idempotencia Semántica (Fase C½ / Hardening de Dominio):
                            // Protección de negocio para evitar duplicados en la UX incluso si el eventId varía.
                            if (eventAuthorityLog.isBadgeProcessed(this.userId, badgeId)) {
                                console.debug(`[Orchestrator] 🛡️ Semantic duplicate suppressed (Badge): ${badgeId}`);
                                return;
                            }

                            // Registrar la insignia en la autoridad para futuras deduplicaciones
                            eventAuthorityLog.record({
                                eventId: data.eventId as string,
                                type: data.type as string,
                                domain: 'user',
                                serverTimestamp: data.serverTimestamp as number,
                                processedAt: Date.now(),
                                originClientId: (data.originClientId as string) || 'unknown'
                            }, `badge_${this.userId}_${badgeId}`);
                        }

                        // 🏅 SOCIAL SSOT: Update gamification cache and profile
                        type GamificationSummary = { newBadges: unknown[]; [key: string]: unknown };
                        queryClient.setQueryData<GamificationSummary>(queryKeys.gamification.summary, (old) => {
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async processFeedDomainLogic(type: string, data: Record<string, unknown>) {
        // SSOT: Use partial for data, data.id for identity
        const payload = (data.partial || data.payload || data) as LegacyPayload;
        const id = data.id || payload.id as string;



        try {
            switch (type) {
                case 'report-create': {
                    const parsed = reportSchema.safeParse(payload);
                    if (parsed.success) {
                        reportsCache.prepend(queryClient, parsed.data);
                        statsCache.applyReportCreate(queryClient, parsed.data.category, parsed.data.status);
                    }
                    break;
                }
                case 'report-update': {
                    const reportIdUpdate = id as string;
                    if (data.isLikeDelta || payload.isLikeDelta) {
                        reportsCache.applyLikeDelta(queryClient, reportIdUpdate, (data.delta || payload.delta) as number);
                    } else if (data.isCommentDelta || payload.isCommentDelta) {
                        reportsCache.applyCommentDelta(queryClient, reportIdUpdate, (data.delta || payload.delta) as number);
                    } else {
                        const parsed = reportSchema.partial().safeParse(payload);
                        if (parsed.success) {
                            // SYSTEMIC FIX: If report is hidden, it must be removed from list caches immediately
                            if (parsed.data.is_hidden === true) {
                                console.debug(`[Orchestrator] 🛡️ Removing hidden report from cache: ${reportIdUpdate}`);
                                reportsCache.remove(queryClient, reportIdUpdate);
                            } else {
                                reportsCache.patch(queryClient, reportIdUpdate, parsed.data);
                            }
                        }
                    }
                    break;
                }
                case 'status-change': {
                    statsCache.applyStatusChange(queryClient, payload.prevStatus as string, payload.newStatus as string);
                    reportsCache.patch(queryClient, id as string, { status: payload.newStatus as 'pendiente' | 'en_proceso' | 'resuelto' | 'cerrado' | 'rechazado' });
                    break;
                }
                case 'report-delete': {
                    const reportIdDelete = id as string;
                    reportsCache.remove(queryClient, reportIdDelete);
                    if (payload.category) {
                        statsCache.applyReportDelete(queryClient, payload.category as string, payload.status as string);
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
     * Acknowledge message delivered to backend
     * Called when this client receives a message (via SSE or Push)
     * INVARIANTE: WhatsApp-grade delivery receipts
     */
    private async acknowledgeMessageDelivered(messageId: string): Promise<void> {
        if (!this.userId) return;
        const sessionToken = sessionAuthority.getToken();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'X-Anonymous-Id': this.userId,
            'X-Client-Id': this.myClientId
        };
        if (sessionToken?.signature) {
            headers['X-Anonymous-Signature'] = sessionToken.signature;
        }
        if (sessionToken?.jwt) {
            headers.Authorization = `Bearer ${sessionToken.jwt}`;
        }

        try {
            await fetch(`${API_BASE_URL}/chats/messages/${messageId}/ack-delivered`, {
                method: 'POST',
                headers
            });
            console.debug(`[Orchestrator] 📬📬 Message DELIVERED ACK sent: ${messageId}`);
        } catch {
            // Silently fail - no es crítico
        }
    }

    /**
     * resync() - Gap Catchup starting from last processed serverTimestamp
     */
    async resync(): Promise<void> {
        if (!this.userId) return;
        const jwt = sessionAuthority.getToken()?.jwt;
        if (!jwt) return;

        const lastAt = await localProcessedLog.getLastProcessedAt(this.userId, 'user');
        console.debug(`[Orchestrator] 🚑 Starting Resync from cursor: ${lastAt}`);

        try {
            const anonymousId = sessionAuthority.getAnonymousId() || this.userId;
            const authQuery = jwt ? `&token=${encodeURIComponent(jwt)}` : '';
            const resp = await fetch(`${API_BASE_URL}/realtime/catchup?since=${lastAt}&anonymousId=${anonymousId}${authQuery}`, {
                headers: jwt ? { Authorization: `Bearer ${jwt}` } : undefined
            });

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
            this.recordFailure(); // 🏛️ ENTERPRISE: Track failure

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
     * unwatchReportComments() - Cleanup social feed subscription for a report
     */
    unwatchReportComments(reportId: string): void {
        const channelId = `social:${reportId}`;
        const unsub = this.dynamicSubscriptions.get(channelId);
        if (unsub) {
            console.debug(`[Orchestrator] 🤫 Unwatching social feed for report: ${reportId}`);
            unsub();
            this.dynamicSubscriptions.delete(channelId);
        }
    }

    /**
     * watchChatRoom() - Dynamic subscription for a chat room
     */
    watchChatRoom(roomId: string, anonymousId: string): void {
        const jwt = sessionAuthority.getToken()?.jwt;
        if (!jwt) return;
        const authQuery = jwt ? `&token=${encodeURIComponent(jwt)}` : '';
        const url = `${API_BASE_URL.replace('/api', '')}/api/realtime/chats/${roomId}?anonymousId=${anonymousId}${authQuery}`;
        const channelId = `social:chat:${roomId}`; // Use social prefix for dynamic routing

        if (this.dynamicSubscriptions.has(channelId)) return;

        console.debug(`[Orchestrator] 💬 Watching chat room: ${roomId}`);

        const unsubs: (() => void)[] = [];
        CHAT_EVENTS.forEach(eventName => {
            unsubs.push(ssePool.subscribe(url, eventName, (event) => this.processRawEvent(event, channelId)));
        });

        this.dynamicSubscriptions.set(channelId, () => {
            unsubs.forEach(u => u());
        });
    }

    /**
     * unwatchChatRoom() - Cleanup chat room subscription
     */
    unwatchChatRoom(roomId: string): void {
        const channelId = `social:chat:${roomId}`;
        const unsub = this.dynamicSubscriptions.get(channelId);
        if (unsub) {
            console.debug(`[Orchestrator] 🤫 Unwatching chat room: ${roomId}`);
            unsub();
            this.dynamicSubscriptions.delete(channelId);
        }
    }

    /**
     * processChatDomainLogic() - Domain logic for chat events (presence, typing, etc.)
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private async processChatDomainLogic(_type: string, _data: Record<string, unknown>) {
        // Many chat events are ephemeral (typing) and don't need cache persistence
        // but some (new-message, delivered) do.
        // For now, Orchestrator focuses on side-effects and persistence.
        // UI reflection is handled by hooks listening to onEvent.
    }

    destroy(): void {
        this.listeners.clear();
        this.activeSubscriptions = [];
        this.dynamicSubscriptions.forEach(unsub => unsub());
        this.dynamicSubscriptions.clear();
        console.debug('[Orchestrator] ⚰️ Destroyed');
    }

    /**
     * 🧹 MEMORY FIX: Limpia listeners y dynamicSubscriptions
     * Llamar en logout para prevenir memory leaks por callbacks huérfanos
     */
    clear(): void {
        this.listeners.clear();
        this.dynamicSubscriptions.forEach(unsub => unsub());
        this.dynamicSubscriptions.clear();
        this.activeSubscriptions = [];
        this.userId = null;
        this.status = 'DISCONNECTED';
        ssePool.clearAll();
        
        // 🧹 MEMORY FIX: Cerrar BroadcastChannel para liberar recursos del navegador
        // Evita acumulación de channels en HMR o múltiples instancias
        if (this.syncChannel) {
            this.syncChannel.close();
        }
        
        // 🏛️ ENTERPRISE: Limpiar circuit breaker
        if (this.circuitResetTimeout) {
            clearTimeout(this.circuitResetTimeout);
            this.circuitResetTimeout = null;
        }
        this.circuitState = CircuitState.CLOSED;
        this.circuitFailureCount = 0;
        
        console.debug('[Orchestrator] 🧹 Cleared listeners and subscriptions');
    }

    // 🏛️ ENTERPRISE: Circuit Breaker Methods
    private recordSuccess(): void {
        if (this.circuitState === CircuitState.HALF_OPEN) {
            this.circuitState = CircuitState.CLOSED;
            this.circuitFailureCount = 0;
            console.log('[Orchestrator] 🔓 Circuit breaker CLOSED');
        }
    }

    private recordFailure(): void {
        this.circuitFailureCount++;
        this.stats.failed++;
        
        if (this.circuitFailureCount >= this.CIRCUIT_THRESHOLD) {
            this.openCircuit();
        }
    }

    private openCircuit(): void {
        this.circuitState = CircuitState.OPEN;
        console.error(`[Orchestrator] 🔴 Circuit breaker OPEN (threshold: ${this.CIRCUIT_THRESHOLD})`);
        
        telemetry.emit({
            engine: 'Orchestrator',
            severity: TelemetrySeverity.ERROR,
            payload: { action: 'circuit_breaker_open', failures: this.circuitFailureCount }
        });
        
        // Auto-reset después de timeout
        this.circuitResetTimeout = setTimeout(() => {
            this.circuitState = CircuitState.HALF_OPEN;
            console.log('[Orchestrator] 🟡 Circuit breaker HALF_OPEN, testing...');
        }, this.CIRCUIT_TIMEOUT_MS);
    }

    private isCircuitOpen(): boolean {
        return this.circuitState === CircuitState.OPEN;
    }

    // 📊 Métricas básicas
    getMetrics(): { received: number; processed: number; dropped: number; failed: number; circuitState: CircuitState } {
        return { ...this.stats, circuitState: this.circuitState };
    }

    getHealthStatus(): 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'DISCONNECTED' {
        if (this.circuitState === CircuitState.OPEN) return 'CRITICAL';
        if (this.stats.failed > this.stats.processed * 0.1) return 'DEGRADED';
        return this.status;
    }

    resetMetrics(): void {
        this.stats = { received: 0, processed: 0, dropped: 0, failed: 0 };
    }
}

// 🛡️ MEM-ROOT-001: Singleton getter para evitar instancias múltiples
const existingInstance = (typeof window !== 'undefined' && 
    (window as Window & { __REALTIME_ORCHESTRATOR_INSTANCE__?: RealtimeOrchestrator }).__REALTIME_ORCHESTRATOR_INSTANCE__) || undefined;
export const realtimeOrchestrator = existingInstance || new RealtimeOrchestrator();
