/**
 * 🎨 Motor 10: View Reconciliation Engine (Enterprise Grade)
 * 
 * Garantiza que el feedback visual (toasts, sonidos, badges) se entregue
 * de forma determinística incluso si la UI no estaba lista originalmente.
 * 
 * 🏛️ ENTERPRISE GRADE:
 * - Priority queue (critical > high > normal > low)
 * - IndexedDB persistence for pending reactions
 * - Comprehensive metrics and telemetry
 * - MutationObserver for route detection (no polling)
 * - Complete lifecycle management (start/stop)
 * - Dead letter queue for failed reactions
 */

import { realtimeOrchestrator } from '../realtime/RealtimeOrchestrator';
import { eventAuthorityLog } from '../realtime/EventAuthorityLog';
import { telemetry, TelemetrySeverity } from '@/lib/telemetry/TelemetryEngine';

export type ReactionType = 'toast' | 'sound' | 'badge' | 'alert';
export type Priority = 'critical' | 'high' | 'normal' | 'low';

export interface VisualReaction {
    eventId: string;
    traceId: string;
    type: ReactionType;
    payload: any;
    expectedRoute?: string;
    priority: Priority;
    createdAt: number;
    attempts: number;
    lastAttempt?: number;
}

interface ReconciliationMetrics {
    totalEnqueued: number;
    totalExecuted: number;
    totalDropped: number;
    totalFailed: number;
    byPriority: Record<Priority, number>;
    byType: Record<ReactionType, number>;
    avgWaitTimeMs: number;
    maxWaitTimeMs: number;
}

type ReactionListener = (reaction: VisualReaction) => void;

// 🏛️ ENTERPRISE: Configuración centralizada
const CONFIG = {
    MAX_EXECUTION_LOG: 500,
    MAX_PENDING_PER_PRIORITY: 100,
    MAX_ATTEMPTS: 3,
    RETRY_DELAY_MS: 1000,
    CLEANUP_INTERVAL_MS: 60000, // 1 minuto
    INDEXEDDB_NAME: 'safespot_viewreconciliation_db',
    INDEXEDDB_STORE: 'pending_reactions',
    INDEXEDDB_VERSION: 1,
    TTL_HOURS: 24,
} as const;

const PRIORITY_ORDER: Priority[] = ['critical', 'high', 'normal', 'low'];

class ViewReconciliationEngine {
    // 🏛️ ENTERPRISE: Priority queues
    private priorityQueues: Map<Priority, VisualReaction[]> = new Map([
        ['critical', []],
        ['high', []],
        ['normal', []],
        ['low', []],
    ]);
    
    private executionLog: Set<string> = new Set();
    private listeners: Set<ReactionListener> = new Set();
    
    // 🏛️ ENTERPRISE: IndexedDB
    private indexedDB: IDBDatabase | null = null;
    
    // 🏛️ ENTERPRISE: Lifecycle
    private isStarted: boolean = false;
    private cleanupIntervalId: ReturnType<typeof setInterval> | null = null;
    private reconciliationIntervalId: ReturnType<typeof setInterval> | null = null;
    
    // 🏛️ ENTERPRISE: State tracking
    private currentRoute: string = typeof window !== 'undefined' ? window.location.pathname : '/';
    private isVisible: boolean = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;
    private mutationObserver: MutationObserver | null = null;
    
    // 🏛️ ENTERPRISE: Dead letter queue
    private deadLetterQueue: VisualReaction[] = [];
    
    // 🏛️ ENTERPRISE: Metrics
    private metrics: ReconciliationMetrics = {
        totalEnqueued: 0,
        totalExecuted: 0,
        totalDropped: 0,
        totalFailed: 0,
        byPriority: { critical: 0, high: 0, normal: 0, low: 0 },
        byType: { toast: 0, sound: 0, badge: 0, alert: 0 },
        avgWaitTimeMs: 0,
        maxWaitTimeMs: 0,
    };
    
    // Para calcular wait times
    private waitTimeAccumulator: number = 0;
    private waitTimeCount: number = 0;

    constructor() {
        console.debug('[ViewReconciliationEngine] 🎨 Enterprise engine initialized');
    }

    // ===========================================
    // 🏛️ ENTERPRISE: LIFECYCLE MANAGEMENT
    // ===========================================

    async start(): Promise<void> {
        if (this.isStarted) return;
        
        console.debug('[ViewReconciliationEngine] 🚀 Starting enterprise engine...');
        
        // 1. Inicializar IndexedDB
        await this.initIndexedDB();
        
        // 2. Cargar reacciones pendientes
        await this.loadPendingFromIndexedDB();
        
        // 3. Setup listeners (sin polling)
        this.setupRouteObserver();
        this.setupVisibilityListener();
        this.connectToOrchestrator();
        
        // 4. Iniciar reconciliation loop
        this.reconciliationIntervalId = setInterval(() => {
            this.reconcile();
        }, 100); // Revisar cada 100ms (10fps)
        
        // 5. Iniciar cleanup TTL
        this.cleanupIntervalId = setInterval(() => {
            this.performCleanup();
        }, CONFIG.CLEANUP_INTERVAL_MS);
        
        this.isStarted = true;
        
        telemetry.emit({
            engine: 'ViewReconciliationEngine',
            severity: TelemetrySeverity.INFO,
            payload: { action: 'engine_started', metrics: { ...this.metrics } }
        });
        
        console.debug('[ViewReconciliationEngine] ✅ Enterprise engine started');
    }

    stop(): void {
        if (!this.isStarted) return;
        
        console.debug('[ViewReconciliationEngine] 🛑 Stopping enterprise engine...');
        
        // Guardar pendientes en IndexedDB
        this.persistPendingToIndexedDB();
        
        // Limpiar intervals
        if (this.reconciliationIntervalId) {
            clearInterval(this.reconciliationIntervalId);
            this.reconciliationIntervalId = null;
        }
        if (this.cleanupIntervalId) {
            clearInterval(this.cleanupIntervalId);
            this.cleanupIntervalId = null;
        }
        
        // Desconectar observer
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }
        
        // Cerrar IndexedDB
        if (this.indexedDB) {
            this.indexedDB.close();
            this.indexedDB = null;
        }
        
        this.isStarted = false;
        
        telemetry.emit({
            engine: 'ViewReconciliationEngine',
            severity: TelemetrySeverity.INFO,
            payload: { action: 'engine_stopped', finalMetrics: { ...this.metrics } }
        });
    }

    // ===========================================
    // 🏛️ ENTERPRISE: INDEXEDDB PERSISTENCE
    // ===========================================

    private async initIndexedDB(): Promise<void> {
        return new Promise((resolve) => {
            const request = indexedDB.open(CONFIG.INDEXEDDB_NAME, CONFIG.INDEXEDDB_VERSION);
            
            request.onerror = () => {
                console.warn('[ViewReconciliationEngine] IndexedDB init failed');
                resolve();
            };
            
            request.onsuccess = () => {
                this.indexedDB = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(CONFIG.INDEXEDDB_STORE)) {
                    const store = db.createObjectStore(CONFIG.INDEXEDDB_STORE, { keyPath: 'eventId' });
                    store.createIndex('priority', 'priority', { unique: false });
                    store.createIndex('createdAt', 'createdAt', { unique: false });
                }
            };
        });
    }

    private async loadPendingFromIndexedDB(): Promise<void> {
        if (!this.indexedDB) return;
        
        try {
            const transaction = this.indexedDB.transaction(CONFIG.INDEXEDDB_STORE, 'readonly');
            const store = transaction.objectStore(CONFIG.INDEXEDDB_STORE);
            const request = store.getAll();
            
            request.onsuccess = () => {
                const reactions: VisualReaction[] = request.result;
                const cutoff = Date.now() - (CONFIG.TTL_HOURS * 60 * 60 * 1000);
                
                reactions.forEach(reaction => {
                    if (reaction.createdAt > cutoff) {
                        const queue = this.priorityQueues.get(reaction.priority);
                        if (queue && queue.length < CONFIG.MAX_PENDING_PER_PRIORITY) {
                            queue.push(reaction);
                            this.metrics.totalEnqueued++;
                            this.metrics.byPriority[reaction.priority]++;
                        }
                    }
                });
                
                console.debug(`[ViewReconciliationEngine] Loaded ${reactions.length} pending reactions`);
                
                // Limpiar después de cargar
                this.clearIndexedDB();
            };
        } catch (e) {
            console.warn('[ViewReconciliationEngine] Failed to load from IndexedDB', e);
        }
    }

    private persistPendingToIndexedDB(): void {
        if (!this.indexedDB) return;
        
        const allPending: VisualReaction[] = [];
        this.priorityQueues.forEach(queue => allPending.push(...queue));
        
        if (allPending.length === 0) return;
        
        try {
            const transaction = this.indexedDB.transaction(CONFIG.INDEXEDDB_STORE, 'readwrite');
            const store = transaction.objectStore(CONFIG.INDEXEDDB_STORE);
            
            allPending.forEach(reaction => {
                store.put(reaction);
            });
        } catch (e) {
            console.warn('[ViewReconciliationEngine] Failed to persist pending', e);
        }
    }

    private clearIndexedDB(): void {
        if (!this.indexedDB) return;
        
        try {
            const transaction = this.indexedDB.transaction(CONFIG.INDEXEDDB_STORE, 'readwrite');
            const store = transaction.objectStore(CONFIG.INDEXEDDB_STORE);
            store.clear();
        } catch (e) {
            console.warn('[ViewReconciliationEngine] Failed to clear IndexedDB', e);
        }
    }

    // ===========================================
    // 🏛️ ENTERPRISE: ROUTE DETECTION (Sin Polling)
    // ===========================================

    private setupRouteObserver(): void {
        if (typeof window === 'undefined') return;
        
        // Detectar cambios de URL via History API
        const originalPushState = history.pushState;
        const originalReplaceState = history.replaceState;
        
        history.pushState = (...args) => {
            originalPushState.apply(history, args);
            this.onRouteChange();
        };
        
        history.replaceState = (...args) => {
            originalReplaceState.apply(history, args);
            this.onRouteChange();
        };
        
        window.addEventListener('popstate', () => this.onRouteChange());
        
        // MutationObserver como backup para SPA routers
        this.mutationObserver = new MutationObserver(() => {
            const currentPath = window.location.pathname;
            if (currentPath !== this.currentRoute) {
                this.onRouteChange();
            }
        });
        
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    private onRouteChange(): void {
        const newRoute = window.location.pathname;
        if (newRoute !== this.currentRoute) {
            console.debug(`[ViewReconciliationEngine] Route changed: ${this.currentRoute} → ${newRoute}`);
            this.currentRoute = newRoute;
            this.onContextChange(newRoute, this.isVisible);
        }
    }

    private setupVisibilityListener(): void {
        if (typeof document === 'undefined') return;
        
        document.addEventListener('visibilitychange', () => {
            this.isVisible = document.visibilityState === 'visible';
            this.onContextChange(this.currentRoute, this.isVisible);
        });
    }

    private connectToOrchestrator(): void {
        realtimeOrchestrator.onEvent((event) => {
            const { eventId, type, payload } = event;
            const traceId = (event as any).traceId || 'unknown';
            
            const isProcessed = (eventAuthorityLog as any).inMemoryLog?.has(eventId);
            if (!isProcessed && type !== 'notification') {
                // Evento volátil
            }
            
            this.processIncomingEvent(eventId, traceId, type, payload);
        });
    }

    // ===========================================
    // 🏛️ ENTERPRISE: CORE LOGIC CON PRIORIDAD
    // ===========================================

    private processIncomingEvent(eventId: string, traceId: string, type: string, payload: any) {
        let reactionType: ReactionType | null = null;
        let expectedRoute: string | undefined = undefined;
        let priority: Priority = 'normal';

        if (type === 'notification' && payload?.type === 'achievement') {
            reactionType = 'badge';
            expectedRoute = '/';
            priority = 'low';
        } else if (type === 'new-message') {
            reactionType = 'toast';
            expectedRoute = 'NOT_IN_CONVERSATION';
            priority = 'high';
        } else if (type === 'security-alert') {
            reactionType = 'alert';
            priority = 'critical';
        }

        if (!reactionType) return;

        const reaction: VisualReaction = {
            eventId,
            traceId,
            type: reactionType,
            payload,
            expectedRoute,
            priority,
            createdAt: Date.now(),
            attempts: 0,
        };

        this.enqueue(reaction);
    }

    private enqueue(reaction: VisualReaction) {
        const key = `${reaction.eventId}_${reaction.type}`;

        // Anti-duplicación
        if (this.executionLog.has(key)) {
            this.metrics.totalDropped++;
            return;
        }

        // Verificar si ya está en cola
        const queue = this.priorityQueues.get(reaction.priority);
        if (!queue) return;
        
        if (queue.some(r => r.eventId === reaction.eventId && r.type === reaction.type)) {
            return;
        }

        // Límite por prioridad
        if (queue.length >= CONFIG.MAX_PENDING_PER_PRIORITY) {
            // Mover el más viejo a dead letter
            const oldest = queue.shift();
            if (oldest) {
                oldest.attempts = CONFIG.MAX_ATTEMPTS;
                this.deadLetterQueue.push(oldest);
                this.metrics.totalDropped++;
            }
        }

        queue.push(reaction);
        this.metrics.totalEnqueued++;
        this.metrics.byPriority[reaction.priority]++;
        this.metrics.byType[reaction.type]++;

        telemetry.emit({
            engine: 'ViewReconciliationEngine',
            severity: TelemetrySeverity.DEBUG,
            payload: { 
                action: 'reaction_enqueued', 
                eventId: reaction.eventId,
                priority: reaction.priority,
                type: reaction.type,
                queueSize: queue.length,
            }
        });

        this.reconcile();
    }

    private onContextChange(route: string, visible: boolean) {
        this.currentRoute = route;
        this.isVisible = visible;
        this.reconcile();
    }

    /**
     * El corazón del Motor 10: Decide qué disparar ahora
     * 🏛️ ENTERPRISE: Procesa por prioridad estricta
     */
    private reconcile() {
        if (!this.isVisible) return; // No ejecutar en background

        const toExecute: VisualReaction[] = [];
        const now = Date.now();

        // Procesar en orden de prioridad estricto
        for (const priority of PRIORITY_ORDER) {
            const queue = this.priorityQueues.get(priority);
            if (!queue) continue;

            const remaining: VisualReaction[] = [];

            for (const reaction of queue) {
                if (this.canExecuteNow(reaction)) {
                    toExecute.push(reaction);
                    
                    // Calcular wait time
                    const waitTime = now - reaction.createdAt;
                    this.waitTimeAccumulator += waitTime;
                    this.waitTimeCount++;
                    this.metrics.avgWaitTimeMs = this.waitTimeAccumulator / this.waitTimeCount;
                    this.metrics.maxWaitTimeMs = Math.max(this.metrics.maxWaitTimeMs, waitTime);
                } else {
                    remaining.push(reaction);
                }
            }

            this.priorityQueues.set(priority, remaining);
        }

        // Ejecutar
        toExecute.forEach(reaction => {
            this.executeReaction(reaction);
        });
    }

    private executeReaction(reaction: VisualReaction): void {
        const key = `${reaction.eventId}_${reaction.type}`;
        
        // Rotation limit
        if (this.executionLog.size >= CONFIG.MAX_EXECUTION_LOG) {
            const oldest = this.executionLog.values().next().value;
            if (oldest) this.executionLog.delete(oldest);
        }

        this.executionLog.add(key);
        reaction.attempts++;
        reaction.lastAttempt = Date.now();

        // Notificar listeners con retry
        let executed = false;
        this.listeners.forEach(fn => {
            try {
                fn(reaction);
                executed = true;
            } catch (e) {
                console.error('[ViewReconciliationEngine] Listener error:', e);
            }
        });

        if (executed) {
            this.metrics.totalExecuted++;
            
            telemetry.emit({
                engine: 'ViewReconciliationEngine',
                severity: TelemetrySeverity.DEBUG,
                payload: { 
                    action: 'reaction_executed', 
                    eventId: reaction.eventId,
                    priority: reaction.priority,
                    waitTimeMs: Date.now() - reaction.createdAt,
                }
            });
        } else {
            // Reintentar si no se ejecutó
            if (reaction.attempts < CONFIG.MAX_ATTEMPTS) {
                setTimeout(() => {
                    const queue = this.priorityQueues.get(reaction.priority);
                    if (queue) queue.push(reaction);
                    this.reconcile();
                }, CONFIG.RETRY_DELAY_MS * reaction.attempts);
            } else {
                this.deadLetterQueue.push(reaction);
                this.metrics.totalFailed++;
                
                telemetry.emit({
                    engine: 'ViewReconciliationEngine',
                    severity: TelemetrySeverity.ERROR,
                    payload: { 
                        action: 'reaction_failed_permanently', 
                        eventId: reaction.eventId,
                        attempts: reaction.attempts,
                    }
                });
            }
        }
    }

    private canExecuteNow(r: VisualReaction): boolean {
        // Regla 1: Si es crítica, siempre que estemos visibles
        if (r.priority === 'critical') return this.isVisible;

        // Regla 2: Ruta esperada
        if (r.expectedRoute === 'NOT_IN_CONVERSATION') {
            const conversationId = r.payload?.message?.conversation_id;
            const isInRoom = this.currentRoute.includes(`/mensajes/${conversationId}`);
            return !isInRoom && this.isVisible;
        }

        if (r.expectedRoute && r.expectedRoute !== this.currentRoute) {
            return false;
        }

        // Regla 3: Visibilidad
        return this.isVisible;
    }

    // ===========================================
    // 🏛️ ENTERPRISE: TTL CLEANUP
    // ===========================================

    private performCleanup(): void {
        const cutoff = Date.now() - (CONFIG.TTL_HOURS * 60 * 60 * 1000);
        let cleanedCount = 0;

        this.priorityQueues.forEach((queue, priority) => {
            const valid = queue.filter(r => {
                if (r.createdAt < cutoff) {
                    cleanedCount++;
                    return false;
                }
                return true;
            });
            this.priorityQueues.set(priority, valid);
        });

        if (cleanedCount > 0) {
            console.debug(`[ViewReconciliationEngine] 🧹 TTL cleanup: removed ${cleanedCount} old reactions`);
        }
    }

    // ===========================================
    // PUBLIC API
    // ===========================================

    public onVisualIntent(fn: ReactionListener): () => void {
        this.listeners.add(fn);
        setTimeout(() => this.reconcile(), 100);
        return () => this.listeners.delete(fn);
    }

    // ===========================================
    // 🏛️ ENTERPRISE: MÉTRICAS Y HEALTH
    // ===========================================

    getMetrics(): ReconciliationMetrics {
        return { ...this.metrics };
    }

    getHealthStatus(): { 
        status: 'healthy' | 'degraded'; 
        pendingCounts: Record<Priority, number>;
        deadLetterCount: number;
    } {
        const pendingCounts = {
            critical: this.priorityQueues.get('critical')?.length || 0,
            high: this.priorityQueues.get('high')?.length || 0,
            normal: this.priorityQueues.get('normal')?.length || 0,
            low: this.priorityQueues.get('low')?.length || 0,
        };
        
        const isDegraded = pendingCounts.critical > 10 || this.deadLetterQueue.length > 50;
        
        return {
            status: isDegraded ? 'degraded' : 'healthy',
            pendingCounts,
            deadLetterCount: this.deadLetterQueue.length,
        };
    }

    getDeadLetterQueue(): VisualReaction[] {
        return [...this.deadLetterQueue];
    }

    clear(): void {
        this.priorityQueues.forEach(queue => queue.length = 0);
        this.executionLog.clear();
        this.deadLetterQueue = [];
        
        // Reset métricas
        this.metrics = {
            totalEnqueued: 0,
            totalExecuted: 0,
            totalDropped: 0,
            totalFailed: 0,
            byPriority: { critical: 0, high: 0, normal: 0, low: 0 },
            byType: { toast: 0, sound: 0, badge: 0, alert: 0 },
            avgWaitTimeMs: 0,
            maxWaitTimeMs: 0,
        };
        this.waitTimeAccumulator = 0;
        this.waitTimeCount = 0;
        
        console.debug('[ViewReconciliationEngine] 🧹 Cleared all queues and metrics');
    }
}

export const viewReconciliationEngine = new ViewReconciliationEngine();
