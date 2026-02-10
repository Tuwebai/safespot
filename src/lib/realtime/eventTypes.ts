/**
 * 🏛️ SAFE MODE: Event Types for RealtimeOrchestrator
 * 
 * MVP de tipos para eventos SSE. Solo los eventos realmente usados hoy.
 * Estrategia: Discriminated unions con fallback a unknown para backward compat.
 * 
 * @version 1.0 - MVP (eventos core)
 */

import type { ChatMessage } from '../api';
import type { Comment } from '../schemas';
import type { Report } from '../api';

// ==========================================
// BASE TYPES
// ==========================================

/**
 * Evento base con discriminated union pattern
 * Todos los eventos tienen type y payload
 */
export interface BaseRealtimeEvent<T extends string = string, P = unknown> {
    type: T;
    payload: P;
    /** ID único del evento para deduplicación */
    eventId?: string;
    /** Timestamp del servidor */
    serverTimestamp?: number;
    /** ID del cliente que originó el evento */
    originClientId?: string;
}

// ==========================================
// CHAT EVENTS (Core del sistema WhatsApp-grade)
// ==========================================

export interface NewMessagePayload {
    message: ChatMessage;
    conversationId: string;
}

export interface ChatUpdatePayload {
    roomId: string;
    message?: ChatMessage;
    action?: 'read' | 'typing' | 'delivered';
    isTyping?: boolean;
    readerId?: string;
}

export interface MessageDeliveredPayload {
    messageId: string;
    conversationId: string;
    receiverId: string;
    deliveredAt: string;
}

export interface MessageReadPayload {
    messageId: string;
    roomId: string;
    readerId: string;
}

export interface PresencePayload {
    userId: string;
    status: 'online' | 'offline';
    lastSeenAt?: string;
}

export interface TypingPayload {
    roomId: string;
    senderId: string;
    isTyping: boolean;
}

// ==========================================
// SOCIAL EVENTS (Comentarios y reportes)
// ==========================================

export interface NewCommentPayload {
    comment: Comment;
    reportId: string;
}

export interface CommentUpdatePayload {
    commentId: string;
    comment?: Partial<Comment>;
    isLikeDelta?: boolean;
    delta?: number;
}

export interface CommentDeletePayload {
    commentId: string;
    reportId: string;
}

export interface ReportUpdatePayload {
    id: string;
    report?: Partial<Report>;
    isLikeDelta?: boolean;
    isCommentDelta?: boolean;
    delta?: number;
}

// ==========================================
// FEED EVENTS (Reportes globales)
// ==========================================

export interface ReportCreatePayload {
    report: Report;
}

export interface StatusChangePayload {
    id: string;
    prevStatus: string;
    newStatus: string;
}

export interface ReportDeletePayload {
    id: string;
    category?: string;
    status?: string;
}

export interface UserCreatePayload {
    // Empty payload, just increments counter
}

// ==========================================
// USER EVENTS (Notificaciones personales)
// ==========================================

export interface NotificationPayload {
    notification: {
        id: string;
        type: string;
        message: string;
        is_read: boolean;
        created_at: string;
    };
}

export interface NotificationsReadAllPayload {
    type: 'notifications-read-all';
}

// ==========================================
// DISCRIMINATED UNION - EVENTOS TIPADOS
// ==========================================

export type TypedRealtimeEvent =
    // Chat
    | { type: 'new-message'; payload: NewMessagePayload }
    | { type: 'chat-update'; payload: ChatUpdatePayload }
    | { type: 'message.delivered'; payload: MessageDeliveredPayload }
    | { type: 'message.read'; payload: MessageReadPayload }
    | { type: 'presence'; payload: PresencePayload }
    | { type: 'typing'; payload: TypingPayload }
    // Social
    | { type: 'new-comment'; payload: NewCommentPayload }
    | { type: 'comment-update'; payload: CommentUpdatePayload }
    | { type: 'comment-delete'; payload: CommentDeletePayload }
    | { type: 'report-update'; payload: ReportUpdatePayload }
    // Feed
    | { type: 'report-create'; payload: ReportCreatePayload }
    | { type: 'status-change'; payload: StatusChangePayload }
    | { type: 'report-delete'; payload: ReportDeletePayload }
    | { type: 'user-create'; payload: UserCreatePayload }
    // User
    | { type: 'notification'; payload: NotificationPayload };

// ==========================================
// FALLBACK PARA EVENTOS NO TIPADOS
// ==========================================

/**
 * Evento genérico con payload unknown.
 * Usar como fallback para eventos no tipados aún.
 * Permite migración progresiva sin romper el sistema.
 */
export interface UntypedRealtimeEvent {
    type: string;
    payload: unknown;
    [key: string]: unknown;
}

// ==========================================
// UNION COMPLETA (Tipados + Fallback)
// ==========================================

/**
 * Tipo principal para eventos del RealtimeOrchestrator.
 * 
 * Estrategia de uso:
 * 1. Intentar narrowing con isTypedEvent()
 * 2. Si es typed → payload está tipado
 * 3. Si es untyped → manejar con type guards manuales
 */
export type RealtimeEvent = TypedRealtimeEvent | UntypedRealtimeEvent;

// ==========================================
// TYPE GUARDS (Narrowing functions)
// ==========================================

/**
 * Verifica si un evento está tipado (está en la discriminated union)
 */
export function isTypedEvent(event: RealtimeEvent): event is TypedRealtimeEvent {
    const typedTypes = [
        'new-message', 'chat-update', 'message.delivered', 'message.read',
        'presence', 'typing',
        'new-comment', 'comment-update', 'comment-delete', 'report-update',
        'report-create', 'status-change', 'report-delete', 'user-create',
        'notification'
    ];
    return typedTypes.includes(event.type);
}

/**
 * Type guard para eventos de chat
 */
export function isChatEvent(event: RealtimeEvent): event is Extract<TypedRealtimeEvent, { type: 'new-message' | 'chat-update' | 'message.delivered' | 'message.read' | 'presence' | 'typing' }> {
    return ['new-message', 'chat-update', 'message.delivered', 'message.read', 'presence', 'typing'].includes(event.type);
}

/**
 * Type guard para new-message específicamente
 */
export function isNewMessageEvent(event: RealtimeEvent): event is { type: 'new-message'; payload: NewMessagePayload } {
    return event.type === 'new-message';
}

/**
 * Type guard para message.delivered
 */
export function isMessageDeliveredEvent(event: RealtimeEvent): event is { type: 'message.delivered'; payload: MessageDeliveredPayload } {
    return event.type === 'message.delivered';
}

/**
 * Type guard para eventos sociales (comentarios)
 */
export function isSocialEvent(event: RealtimeEvent): event is Extract<TypedRealtimeEvent, { type: 'new-comment' | 'comment-update' | 'comment-delete' }> {
    return ['new-comment', 'comment-update', 'comment-delete'].includes(event.type);
}

// ==========================================
// LEGACY COMPATIBILITY (transición suave)
// ==========================================

/**
 * @deprecated Usar RealtimeEvent en su lugar
 * Este tipo existe solo para compatibilidad durante la migración
 */
export type RealtimeEventLegacy = {
    type: string;
    payload: unknown;
    id?: string;
    partial?: unknown;
};

/**
 * Helper para extraer payload de forma segura de eventos legacy
 */
export function getLegacyPayload<T>(event: RealtimeEventLegacy): T | undefined {
    return (event.partial || event.payload) as T | undefined;
}
