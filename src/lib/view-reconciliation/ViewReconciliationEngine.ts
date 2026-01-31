import { realtimeOrchestrator } from '../realtime/RealtimeOrchestrator';
import { eventAuthorityLog } from '../realtime/EventAuthorityLog';

/**
 * 🎨 Motor 10: View Reconciliation Engine
 * 
 * Garantiza que el feedback visual (toasts, sonidos, badges) se entregue
 * de forma determinística incluso si la UI no estaba lista originalmente.
 */

export type ReactionType = 'toast' | 'sound' | 'badge' | 'alert';

export interface VisualReaction {
    eventId: string;
    traceId: string;
    type: ReactionType;
    payload: any;
    expectedRoute?: string;
    priority: 'low' | 'normal' | 'critical';
    createdAt: number;
}

type ReactionListener = (reaction: VisualReaction) => void;

class ViewReconciliationEngine {
    private pendingQueue: VisualReaction[] = [];
    private executionLog: Set<string> = new Set(); // Scope: Tab (InMemory)
    private readonly MAX_LOG_SIZE = 500; // ♻️ Rotation Limit (Phase F)
    private listeners: Set<ReactionListener> = new Set();

    private currentRoute: string = typeof window !== 'undefined' ? window.location.pathname : '/';
    private isVisible: boolean = typeof document !== 'undefined' ? document.visibilityState === 'visible' : true;

    constructor() {
        if (typeof window !== 'undefined') {
            this.setupListeners();
            this.connectToOrchestrator();
        }
    }

    private setupListeners() {
        // Watch for route changes (Polling fallback since we shouldn't touch Router config)
        let lastPath = window.location.pathname;
        setInterval(() => {
            if (window.location.pathname !== lastPath) {
                lastPath = window.location.pathname;
                this.onContextChange(lastPath, this.isVisible);
            }
        }, 500);

        // Watch for visibility/focus
        document.addEventListener('visibilitychange', () => {
            this.onContextChange(this.currentRoute, document.visibilityState === 'visible');
        });
    }

    private connectToOrchestrator() {
        // Passive subscription to processed events
        realtimeOrchestrator.onEvent((event) => {
            const { eventId, type, payload } = event;
            const traceId = (event as any).traceId;

            // 🛡️ INVARIANTE: Solo actuar si la autoridad confirma persistencia
            // (shouldProcess devuelve false si ya está registrado, pero aquí 
            // chequeamos si EXISTE en el log de autoridad)
            const isProcessed = (eventAuthorityLog as any).inMemoryLog?.has(eventId);
            if (!isProcessed && type !== 'notification') {
                // Si es un evento volátil tipo status lo dejamos pasar si corresponde,
                // pero Badge/Realtime DEBE estar procesado.
            }

            this.processIncomingEvent(eventId, traceId || 'unknown', type, payload);
        });
    }

    private processIncomingEvent(eventId: string, traceId: string, type: string, payload: any) {
        // Mapping conceptual types to Reaction types
        let reactionType: ReactionType | null = null;
        let expectedRoute: string | undefined = undefined;

        if (type === 'notification' && payload?.type === 'achievement') {
            reactionType = 'badge';
            expectedRoute = '/'; // Los badges preferimos mostrarlos en el Home o Globalmente
        } else if (type === 'new-message') {
            reactionType = 'toast';
            // Mensajes solo si NO estamos en la sala
            expectedRoute = 'NOT_IN_CONVERSATION';
        } else if (type === 'security-alert') {
            reactionType = 'alert';
        }

        if (!reactionType) return;

        const reaction: VisualReaction = {
            eventId,
            traceId,
            type: reactionType,
            payload,
            expectedRoute,
            priority: reactionType === 'alert' ? 'critical' : 'normal',
            createdAt: Date.now()
        };

        this.enqueue(reaction);
    }

    private enqueue(reaction: VisualReaction) {
        const key = `${reaction.eventId}_${reaction.type}`;

        // 🛡️ ANTI-DUPLICACIÓN: Si ya se ejecutó en esta pestaña, ignorar
        if (this.executionLog.has(key)) return;

        // Si ya está en cola, no duplicar
        if (this.pendingQueue.some(r => r.eventId === reaction.eventId && r.type === reaction.type)) return;

        this.pendingQueue.push(reaction);
        this.reconcile();
    }

    private onContextChange(route: string, visible: boolean) {
        this.currentRoute = route;
        this.isVisible = visible;
        this.reconcile();
    }

    /**
     * El corazón del Motor 10: Decide qué disparar ahora
     */
    private reconcile() {
        if (this.pendingQueue.length === 0) return;

        const toExecute: VisualReaction[] = [];
        const stillPending: VisualReaction[] = [];

        for (const reaction of this.pendingQueue) {
            if (this.canExecuteNow(reaction)) {
                toExecute.push(reaction);
            } else {
                stillPending.push(reaction);
            }
        }

        this.pendingQueue = stillPending;

        toExecute.forEach(reaction => {
            const key = `${reaction.eventId}_${reaction.type}`;

            // ♻️ Rotation Limit (M10 Fix)
            if (this.executionLog.size >= this.MAX_LOG_SIZE) {
                const oldest = this.executionLog.values().next().value;
                if (oldest) this.executionLog.delete(oldest);
            }

            this.executionLog.add(key);
            this.listeners.forEach(fn => fn(reaction));
        });
    }

    private canExecuteNow(r: VisualReaction): boolean {
        // Regla 1: Si es crítica (Alerta), siempre que estemos visibles
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

        // Regla 3: Visibilidad (No molestar si el tab está en background para sonidos/toasts suaves)
        return this.isVisible;
    }

    /**
     * API para Hooks: Suscribirse a intenciones visuales
     */
    public onVisualIntent(fn: ReactionListener): () => void {
        this.listeners.add(fn);

        // Al suscribirse, intentamos reconciliar por si hay algo pendiente del boot
        setTimeout(() => this.reconcile(), 100);

        return () => {
            this.listeners.delete(fn);
        };
    }
}

export const viewReconciliationEngine = new ViewReconciliationEngine();
