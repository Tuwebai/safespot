import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatsApi, ChatMessage, ChatRoom } from '../../lib/api';
import { useEffect, useState, useRef } from 'react';
import { getClientId } from '@/lib/clientId';
import { useToast } from '../../components/ui/toast';
// Eliminado ssePool de aquí ya que se usa via Orchestrator
import { realtimeOrchestrator } from '@/lib/realtime/RealtimeOrchestrator';
import { chatCache } from '../../lib/chatCache';
import { useAnonymousId } from '@/hooks/useAnonymousId';
import { chatBroadcast } from '@/lib/chatBroadcast';
import { playNotificationSound } from '@/lib/sound';
// ✅ PHASE 2: Auth Guard for Mutations
import { useAuthGuard } from '@/hooks/useAuthGuard';
import { guardIdentityReady, IdentityNotReadyError } from '@/lib/guards/identityGuard';
import { IdentityInvariantViolation } from '@/lib/errors/IdentityInvariantViolation';
import { requireAnonymousId } from '@/lib/auth/identityResolver';
import { sessionAuthority } from '@/engine/session/SessionAuthority';

export interface UserPresence {
    status: 'online' | 'offline';
    last_seen_at: string | null;
}

// 🏛️ ARCHITECTURAL FIX: ACK de mensajes es responsabilidad EXCLUSIVA de RealtimeOrchestrator
// Los hooks NO pueden confirmar entrega - solo actualizan UI



const CHATS_KEYS = {
    all: ['chats'] as const,
    rooms: (anonymousId: string) => ['chats', 'rooms', anonymousId] as const,
    conversation: (id: string, anonymousId: string) => ['chats', 'conversation', anonymousId, id] as const,
    messages: (convId: string, anonymousId: string) => ['chats', 'messages', anonymousId, convId] as const,
    message: (id: string) => ['chats', 'message', id] as const,
    presence: (userId: string) => ['users', 'presence', userId] as const,
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

export function messageLikeFromPayload(payload: Record<string, unknown>): Record<string, unknown> | null {
    const nestedMessage = payload.message;
    if (isRecord(nestedMessage)) return nestedMessage;
    const partial = payload.partial;
    if (isRecord(partial) && typeof partial.id === 'string' && typeof partial.conversation_id === 'string') return partial;
    if (typeof payload.id === 'string' && typeof payload.conversation_id === 'string') return payload;
    return null;
}

export function conversationIdFromPayload(payload: Record<string, unknown>): string | null {
    const direct = payload.roomId || payload.conversationId || payload.conversation_id;
    if (typeof direct === 'string' && direct.length > 0) return direct;
    const msg = messageLikeFromPayload(payload);
    if (!msg) return null;
    const nested = msg.conversation_id || msg.conversationId || msg.roomId;
    return typeof nested === 'string' && nested.length > 0 ? nested : null;
}

export function normalizeIncomingRealtimeMessage(payload: Record<string, unknown>): ChatMessage | null {
    const msg = messageLikeFromPayload(payload);
    if (!msg) return null;
    const conversationId = conversationIdFromPayload(payload);
    const messageId = (msg.id || payload.id) as string | undefined;
    const senderId = (msg.sender_id || msg.senderId) as string | undefined;
    if (!messageId || !conversationId || !senderId) return null;

    const normalized: ChatMessage = {
        ...(msg as unknown as ChatMessage),
        id: messageId,
        conversation_id: conversationId,
        sender_id: senderId,
        content: (msg.content as string) || '',
        type: ((msg.type as ChatMessage['type']) || 'text'),
        created_at: (msg.created_at as string) || new Date().toISOString(),
        is_read: Boolean(msg.is_read),
        is_delivered: Boolean(msg.is_delivered)
    };
    return normalized;
}

export function isConversationActiveAndVisible(conversationId: string): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;
    const isActiveRoute = window.location.pathname.includes(`/mensajes/${conversationId}`);
    return isActiveRoute && document.visibilityState === 'visible';
}



/**
 * Chat Rooms Hook
 * 
 * Scope Mapping:
 * - 'chat-update': Patches canonical room status (last message, unread status) in sidebar.
 */
export function useChatRooms() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ SSOT (reactive)

    const query = useQuery({
        queryKey: ['chats', 'rooms', anonymousId],  // ✅ Include ID
        queryFn: async () => {
            const rooms = await chatsApi.getAllRooms();
            // Store each room in detail cache for individual reactivity
            rooms.forEach(room => {
                queryClient.setQueryData(CHATS_KEYS.conversation(room.id, anonymousId || ''), room);

                // Seed Presence Cache if available
                if (room.other_participant_id) {
                    queryClient.setQueryData<UserPresence>(CHATS_KEYS.presence(room.other_participant_id), {
                        status: room.is_online ? 'online' : 'offline',
                        last_seen_at: room.other_participant_last_seen || null
                    });
                }

            });
            return rooms;
        },
        enabled: !!anonymousId,  // ✅ CRITICAL
        refetchInterval: 60000,
    });

    useEffect(() => {
        if (!anonymousId) return;


        // 👑 NEW: Unified Orchestrator Authority for Domain Events
        const unsubOrchestrator = realtimeOrchestrator.onEvent((event) => {
            const { type, payload } = event;
            // 🏛️ SAFE MODE: Type assertion para compatibilidad durante migración
            const payloadObj = payload as Record<string, unknown>;
            const actualPayload = (payloadObj.partial as Record<string, unknown>) || payloadObj;

            if (type === 'chat-update') {
                const convId = actualPayload.roomId;
                if (!convId) return;

                if (actualPayload.message) {
                    const message = actualPayload.message as ChatMessage;
                    const isActiveRoom = isConversationActiveAndVisible(convId as string);
                    chatCache.applyInboxUpdate(queryClient, message, anonymousId, isActiveRoom);
                } else if (actualPayload.action === 'read') {
                    chatCache.markRoomAsRead(queryClient, convId as string, anonymousId);
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId as string, anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                    });
                } else if (actualPayload.action === 'typing') {
                    queryClient.setQueryData(CHATS_KEYS.rooms(anonymousId), (old: unknown) => {
                        if (!old || !Array.isArray(old)) return old;
                        return old.map((r: { id: string }) => r.id === convId ? { ...r, is_typing: actualPayload.isTyping as boolean } : r);
                    });
                }
            } else if (type === 'message.delivered') {
                const convId = actualPayload.conversationId as string;
                if (!convId) return;
                chatCache.applyDeliveryUpdate(queryClient, convId, anonymousId, actualPayload as { messageId?: string; id?: string });
            } else if (type === 'message.read') {
                if (actualPayload.readerId !== anonymousId && actualPayload.roomId) {
                    chatCache.applyReadReceipt(queryClient, actualPayload.roomId as string, anonymousId);
                }
            } else if (type === 'chat-rollback') {
                if (actualPayload.roomId && actualPayload.messageId) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(actualPayload.roomId as string, anonymousId), (old) => {
                        if (!old) return old;
                        return old.filter(m => m.id !== (actualPayload.messageId as string));
                    });
                }
            } else if (type === 'presence-update' || type === 'presence') {
                if (actualPayload.userId) {
                    const presence: UserPresence = {
                        status: actualPayload.status as 'online' | 'offline',
                        last_seen_at: (actualPayload.last_seen_at as string) || null
                    };
                    queryClient.setQueryData<UserPresence>(CHATS_KEYS.presence(actualPayload.userId as string), presence);
                    queryClient.setQueryData<ChatRoom[]>(CHATS_KEYS.rooms(anonymousId), (old) => {
                        if (!old || !Array.isArray(old)) return old;
                        return old.map(r => r.other_participant_id === actualPayload.userId
                            ? { ...r, is_online: actualPayload.status === 'online', other_participant_last_seen: actualPayload.status === 'offline' ? new Date().toISOString() : r.other_participant_last_seen }
                            : r
                        );
                    });
                }
            }
        });

        return () => {
            unsubOrchestrator();
        };

    }, [anonymousId, queryClient]);

    return query;
}

/**
 * Individual Conversation Hook (Normalized)
 */
export function useConversation(id: string | undefined) {
    const anonymousId = useAnonymousId();
    return useQuery({
        queryKey: CHATS_KEYS.conversation(id || '', anonymousId || ''),
        queryFn: async () => {
            if (!id) return null;
            const rooms = await chatsApi.getAllRooms();
            const room = rooms.find(r => r.id === id);
            return room || null; // ✅ Fix: React Query hates undefined
        },
        enabled: !!id && !!anonymousId,
        staleTime: Infinity, // Passive patching via SSE
    });
}

/**
 * Hook para obtener y gestionar mensajes de una sala específica (con tiempo real)
 * 
 * ✅ WhatsApp-Grade Features:
 * - Real-time SSE updates
 * - Gap recovery on reconnection
 * - Optimistic UI support
 */
export function useChatMessages(convId: string | undefined) {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ SSOT (reactive)

    // Real-time state for typing with anti-stale protection
    const [isTyping, setIsTyping] = useState(false);
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // ✅ Anti-Stale: Clear typing after 5s of no new events
    const TYPING_TIMEOUT_MS = 5000;

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }
        };
    }, []);


    const query = useQuery({
        queryKey: ['chats', 'messages', anonymousId, convId || ''],  // ✅ Include ID
        queryFn: async () => {
            if (!convId) return [];
            const messages = await chatsApi.getMessages(convId);
            
            // 🏛️ ENTERPRISE FIX: Offline Delivery Reconciliation
            // Cuando cargamos mensajes, reconciliamos el estado de entrega/leído
            // para mensajes que fueron enviados por OTROS y aún no están marcados
            const messagesNeedingReconciliation = messages.filter(m => 
                m.sender_id !== anonymousId && (!m.is_delivered || !m.is_read)
            );
            
            if (messagesNeedingReconciliation.length > 0) {
                const toMarkDelivered = messagesNeedingReconciliation
                    .filter(m => !m.is_delivered)
                    .map(m => m.id);
                const toMarkRead = messagesNeedingReconciliation
                    .filter(m => !m.is_read)
                    .map(m => m.id);
                
                // Fire-and-forget reconciliation (no await to not block UI)
                chatsApi.reconcileStatus({
                    delivered: toMarkDelivered,
                    read: toMarkRead
                }).catch(() => {
                    // Silently fail - will retry on next load
                });
            }
            
            return messages;
        },
        enabled: !!convId && !!anonymousId,  // ✅ Both required
        staleTime: Infinity, // ✅ ENTERPRISE: No refetch automático - SSE es la fuente de actualizaciones
        gcTime: 1000 * 60 * 30, // 30 min garbage collection
        refetchOnWindowFocus: false, // ✅ CONTROLADO MANUALMENTE (ver abajo)
        refetchOnReconnect: false, // ✅ Gap Recovery maneja reconexión
    });

    // ✅ STATUS RECONCILIATION (Lost Write Fix)
    // Cuando el usuario vuelve a la app (tab focus o app switching), forzamos
    // una reconciliación de estado para actualizar "tildes" (Delivered/Read)
    // que pudieron llegar por SSE mientras la app estaba en background.
    useEffect(() => {
        const handleFocus = () => {
            if (convId && anonymousId) {
                // Invalidate forcea un refetch aunque staleTime sea Infinity
                queryClient.invalidateQueries({ queryKey: CHATS_KEYS.messages(convId, anonymousId) });
            }
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [convId, anonymousId, queryClient]);

    // ✅ ENTERPRISE FIX: Rehydrate Persistent Outbox on Mount (F5 Recovery)
    useEffect(() => {
        if (convId && anonymousId) {
            chatCache.rehydratePendingMessages(queryClient, convId, anonymousId);
        }
    }, [convId, anonymousId, queryClient]);

    // Integración Realtime via Orchestrator (SSOT)
    useEffect(() => {
        if (!convId || !anonymousId) return;

        // 1. Tell Orchestrator to watch this room
        realtimeOrchestrator.watchChatRoom(convId, anonymousId);

        // 2. Listen for UI Side-Effects
        const unsubscribe = realtimeOrchestrator.onEvent((event) => {
            const { type, payload, originClientId } = event;
            // 🏛️ SAFE MODE: Type assertion para compatibilidad durante migración
            const actualPayload = isRecord(payload) ? payload : {};

            // Filter for THIS room
            const roomId = conversationIdFromPayload(actualPayload);
            if (roomId !== convId) return;

            // Echo suppression
            if (originClientId === getClientId()) return;

            switch (type) {
                case 'new-message':
                    const normalizedMessage = normalizeIncomingRealtimeMessage(actualPayload);
                    if (!normalizedMessage) return;
                    chatCache.upsertMessage(queryClient, normalizedMessage, anonymousId);
                    if (normalizedMessage.sender_id !== anonymousId) {
                        if (isConversationActiveAndVisible(convId)) {
                            chatCache.markRoomAsRead(queryClient, convId, anonymousId);
                            chatsApi.markAsRead(convId).catch(() => {
                                // Silent: backend will reconcile on next focus/resync
                            });
                        }
                        playNotificationSound();
                    }
                    break;
                case 'typing':
                    if ((actualPayload.senderId as string) !== anonymousId) {
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        setIsTyping(actualPayload.isTyping as boolean);
                        if (actualPayload.isTyping) {
                            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), TYPING_TIMEOUT_MS);
                        }
                    }
                    break;
                case 'message.read':
                    if ((actualPayload.readerId as string) !== anonymousId) {
                        chatCache.applyReadReceipt(queryClient, convId, anonymousId);
                    }
                    break;
                case 'message.delivered':
                    chatCache.applyDeliveryUpdate(queryClient, convId, anonymousId, actualPayload as { messageId?: string; id?: string });
                    break;
                case 'presence':
                    if (actualPayload.userId) {
                        queryClient.setQueryData(CHATS_KEYS.presence(actualPayload.userId as string), {
                            status: actualPayload.status as 'online' | 'offline',
                            last_seen_at: actualPayload.status === 'offline' ? new Date().toISOString() : null
                        });
                    }
                    break;
                case 'message-deleted':
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        return old?.filter(m => m.id === actualPayload.id || m.id === actualPayload.messageId ? false : true) || [];
                    });
                    break;
                case 'message-reaction':
                    if (actualPayload.messageId && actualPayload.reactions) {
                        queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                            if (!old) return old;
                            return old.map(m => m.id === actualPayload.messageId ? { ...m, reactions: actualPayload.reactions as Record<string, string[]> } : m);
                        });
                    }
                    break;
                case 'message-pinned':
                    // Update cache... (logic same as before, but from actualPayload)
                    const pinnedId = actualPayload.pinnedMessageId as string | null;
                    queryClient.setQueryData<ChatRoom[]>(CHATS_KEYS.rooms(anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(r => r.id === convId ? { ...r, pinned_message_id: pinnedId } : r);
                    });
                    queryClient.setQueryData<ChatRoom>(CHATS_KEYS.conversation(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return { ...old, pinned_message_id: pinnedId } as ChatRoom;
                    });
                    break;
            }
        });

        return () => {
            realtimeOrchestrator.unwatchChatRoom(convId);
            unsubscribe();
        };
    }, [convId, anonymousId, queryClient]);

    return { ...query, isOtherTyping: isTyping };
}


/**
 * Hook to get just the list of IDs for virtualization
 */
export function useChatMessageIds(roomId: string | undefined) {
    const anonymousId = useAnonymousId();
    return useQuery({
        queryKey: CHATS_KEYS.messages(roomId || '', anonymousId || ''),
        queryFn: () => roomId ? chatsApi.getMessages(roomId) : Promise.resolve([]),
        enabled: !!roomId && !!anonymousId,
        select: (data) => data.map(m => m.id),
    });
}

/**
 * Hook to get a single message by ID from the cache
 */
export function useChatMessage(roomId: string, messageId: string) {
    const anonymousId = useAnonymousId();
    return useQuery({
        queryKey: CHATS_KEYS.messages(roomId, anonymousId || ''),
        enabled: false, // Purely for cache reading usually, but here we want reactivity

        select: (data: ChatMessage[]) => data.find((m) => m.id === messageId),
    });
}

/**
 * Hook to get canonical presence for a user
 */
export function useUserPresence(userId: string | undefined) {
    const queryClient = useQueryClient();

    return useQuery({
        queryKey: CHATS_KEYS.presence(userId || ''),
        queryFn: async (): Promise<UserPresence | null> => {
            if (!userId) return null;
            // Initially, we might want to fetch last_seen from DB if not in cache
            // For now, if it's not in cache, we assume offline/unknown
            return queryClient.getQueryData<UserPresence>(CHATS_KEYS.presence(userId)) || { status: 'offline', last_seen_at: null };
        },
        enabled: !!userId,
        staleTime: Infinity,
    });
}




/**
 * Mutation para enviar mensajes
 */
export function useSendMessageMutation() {
    const queryClient = useQueryClient();
    // Hook must be called at top level; value read from SessionAuthority directly in mutation
    useAnonymousId();
    const toast = useToast();
    const { checkAuth } = useAuthGuard(); // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async ({ roomId, content, type, caption, file, replyToId, id }: {
            roomId: string;
            content: string;
            type?: 'text' | 'image' | 'sighting' | 'location',
            caption?: string,
            file?: File,
            replyToId?: string,
            replyToContent?: string;
            replyToType?: string;
            replyToSenderAlias?: string;
            replyToSenderId?: string;
            id?: string; // ✅ Enterprise: Client-Gen ID
        }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            if (type === 'image' && file) {
                const { url } = await chatsApi.uploadChatImage(roomId, file);
                return chatsApi.sendMessage(roomId, url, type, caption, replyToId, id);
            }
            return chatsApi.sendMessage(roomId, content, type, caption, replyToId, id);
        },


        onMutate: async (variables) => {
            // ✅ ENTERPRISE FIX: Identity Gate (ANTES de optimistic update)
            try {
                guardIdentityReady();
            } catch (e) {
                if (e instanceof IdentityNotReadyError) {
                    toast.error('Identidad no lista. Intenta nuevamente en unos segundos.');
                }
                throw e;
            }

            // ✅ SSOT: Obtener ID garantizado directamente de SessionAuthority
            // Esto nunca falla si guardIdentityReady() pasó
            const senderId = requireAnonymousId();

            // Cancelar refetches salientes
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(variables.roomId, senderId) });

            // Snapshot del valor previo
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId, senderId));

            // Optimistic update logic
            let optimisticContent = variables.content;
            if (variables.type === 'image' && variables.file) {
                optimisticContent = URL.createObjectURL(variables.file);
            }

            // Generate stable temp ID for tracking
            // ✅ Enterprise: Use crypto.randomUUID for globally unique Client-Side ID
            const tempId = variables.id || self.crypto.randomUUID();
            


            const optimisticMessage: ChatMessage = {
                id: tempId,
                conversation_id: variables.roomId,
                sender_id: senderId,  // ✅ SSOT garantizado por SessionAuthority
                content: variables.type === 'image' && variables.file ? '' : variables.content,
                localUrl: optimisticContent.startsWith('blob:') ? optimisticContent : undefined,
                localStatus: 'pending', // ✅ UX: Clock Icon
                type: variables.type || 'text',
                caption: variables.caption,
                is_read: false,
                is_delivered: false,
                reply_to_id: variables.replyToId,
                reply_to_content: variables.replyToContent,
                reply_to_type: variables.replyToType,
                reply_to_sender_alias: variables.replyToSenderAlias || 'Mensaje',
                reply_to_sender_id: variables.replyToSenderId,

                created_at: new Date().toISOString(),
                sender_alias: 'Tú',
            };

            // ✅ Enterprise: Idempotent Upsert + Sort
            chatCache.upsertMessage(queryClient, optimisticMessage, senderId);

            // ✅ PERSISTENCE: Save to localStorage (Survives F5)
            chatCache.persistPendingMessage(variables.roomId, optimisticMessage);

            // ✅ Multi-Tab Sync: Broadcast to other tabs (0ms)
            chatBroadcast.emit({
                type: 'new-message',
                roomId: variables.roomId,
                message: optimisticMessage
            });

            // 1. WhatsApp-Grade: Promote room to top IMMEDIATELY (Atomic Reordering)
            chatCache.applyInboxUpdate(queryClient, optimisticMessage, senderId, true);

            // 2. Update Conversation detail cache (last message)
            queryClient.setQueryData(CHATS_KEYS.conversation(variables.roomId, senderId), (old: any) => ({
                ...old,
                last_message_content: optimisticMessage.content,
                last_message_at: optimisticMessage.created_at,
                last_message_sender_id: optimisticMessage.sender_id
            }));

            // Pass context
            return { previousMessages, blobUrl: optimisticContent.startsWith('blob:') ? optimisticContent : null };
        },

        onError: (err, variables, _context) => {
            // ✅ ENTERPRISE FIX: IdentityNotReadyError no es un error de red
            if (err instanceof IdentityNotReadyError || err instanceof IdentityInvariantViolation) {
                return;
            }

            const senderId = sessionAuthority.getAnonymousId() || '';
            const isNetworkError = !navigator.onLine || err.message === 'Failed to fetch' || (err as any).status === 0;
            const messageId = variables.id || '';

            // 🆕 UX FEATURE: Mark as failed instead of rollback
            // Both network errors and server errors show as "failed" with retry option
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId, senderId), (old) => {
                if (!old) return old;
                return old.map(m => m.id === messageId 
                    ? { ...m, localStatus: 'failed' as const }
                    : m
                );
            });

            // Keep in persistence so user can retry after F5
            if (isNetworkError) {
                // Network errors: keep pending state for background sync
                return;
            }

            // Server errors: notify but keep message visible with failed status
            toast.error('Error al enviar. Tocá el mensaje para reintentar.');
        },


        onSuccess: (newMessage, variables, context) => {
            // ✅ SSOT: Obtener ID actual para operaciones de cache
            const currentId = sessionAuthority.getAnonymousId();
            if (!currentId) return; // No cache update if identity lost (edge case)

            // Reemplazar el mensaje optimista manteniendo el localUrl para la transición
            const confirmedMessage = {
                ...newMessage,
                localUrl: context?.blobUrl || undefined,
                // Server confirmed (implicit status: sent)
            };

            // ✅ Enterprise: Idempotent Upsert (Merges pending -> sent)
            chatCache.upsertMessage(queryClient, confirmedMessage, currentId);

            // ✅ PERSISTENCE: Remove from pending storage (It's safe now)
            if (newMessage.id) chatCache.removePendingMessage(variables.roomId, newMessage.id);

            // 1. WhatsApp-Grade: Promote room to top IMMEDIATEMENTE on success (reconcile)
            chatCache.applyInboxUpdate(queryClient, confirmedMessage, currentId, true);
        }
    });
}

/**
 * Mutation para crear o abrir una sala
 */
export function useCreateChatMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();
    const { checkAuth } = useAuthGuard(); // ✅ PHASE 2: Auth guard

    return useMutation({
        mutationFn: async (params: { reportId?: string; recipientId?: string }) => {
            // ✅ AUTH GUARD: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return chatsApi.createRoom(params);
        },
        onSuccess: () => {
            if (anonymousId) {
                queryClient.invalidateQueries({ queryKey: CHATS_KEYS.rooms(anonymousId) });
            }
        },
    });
}
/**
 * Mutation para marcar sala como leída
 */
export function useMarkAsReadMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ ENTERPRISE FIX: Clean UUID at top level
    const { checkAuth } = useAuthGuard();  // 🔴 SECURITY FIX: Auth guard

    return useMutation({
        mutationFn: async (roomId: string) => {
            // 🔴 SECURITY FIX: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return chatsApi.markAsRead(roomId);
        },
        onSuccess: (_, roomId) => {
            if (!anonymousId) return;
            // 1. Patch Global Inbox List (Sidebar)
            chatCache.markRoomAsRead(queryClient, roomId, anonymousId);

            // 2. Patch Detail Conversation (Handled inside markRoomAsRead but explicit check here if needed or redundant)
            // chatCache.markRoomAsRead already handles detail cache.

            // 3. Patch Messages list
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                if (!old) return old;
                return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
            });
        },
    });
}

/**
 * Mutation para marcar sala como entregada
 */
export function useMarkAsDeliveredMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();  // ✅ ENTERPRISE FIX: Clean UUID at top level
    const { checkAuth } = useAuthGuard();  // 🔴 SECURITY FIX: Auth guard

    return useMutation({
        mutationFn: async (roomId: string) => {
            // 🔴 SECURITY FIX: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return chatsApi.markAsDelivered(roomId);
        },
        onSuccess: (_, roomId) => {
            if (!anonymousId) return;
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                if (!old) return old;
                return old.map(m => m.sender_id === anonymousId ? { ...m, is_delivered: true } : m);
            });
        },
    });
}

/**
 * Mutation para reaccionar a un mensaje
 */
export function useReactionMutation() {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();
    const { checkAuth } = useAuthGuard();  // 🔴 SECURITY FIX: Auth guard

    return useMutation({
        mutationFn: async ({ roomId, messageId, emoji }: { roomId: string; messageId: string; emoji: string }) => {
            // 🔴 SECURITY FIX: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return chatsApi.reactToMessage(roomId, messageId, emoji);
        },
        onMutate: async ({ roomId, messageId, emoji }) => {
            if (!anonymousId) return;

            // 1. Cancel outgoing refetches
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(roomId, anonymousId) });

            // 2. Snapshot previous state
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId));

            // 3. Optimistic Update
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                if (!old) return old;

                return old.map(msg => {
                    if (msg.id !== messageId) return msg;

                    // Logic: Single reaction per user (WhatsApp Style)
                    const reactions = { ...(msg.reactions || {}) };
                    let alreadyHasThisEmoji = false;

                    // A. Remove 'Me' from ALL existing reactions
                    Object.keys(reactions).forEach(key => {
                        if (reactions[key].includes(anonymousId)) {
                            // If this was the SAME emoji we are clicking, mark flag
                            if (key === emoji) alreadyHasThisEmoji = true;

                            // Filter me out
                            reactions[key] = reactions[key].filter(id => id !== anonymousId);

                            // Cleanup empty arrays
                            if (reactions[key].length === 0) {
                                delete reactions[key];
                            }
                        }
                    });

                    // B. If I did NOT already have this emoji, ADD me to it.
                    // (If I did have it, we just removed it above -> Toggle Off)
                    if (!alreadyHasThisEmoji) {
                        if (!reactions[emoji]) reactions[emoji] = [];
                        reactions[emoji].push(anonymousId);
                    }

                    return { ...msg, reactions };
                });
            });

            return { previousMessages };
        },
        onError: (_err, variables, context) => {
            if (context?.previousMessages && anonymousId) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId, anonymousId), context.previousMessages);
            }
        }
    });
}

// Helpers removed - using chatCache

export const useDeleteMessageMutation = () => {
    const queryClient = useQueryClient();
    const anonymousId = useAnonymousId();
    const { checkAuth } = useAuthGuard();  // 🔴 SECURITY FIX: Auth guard

    return useMutation({
        mutationFn: async ({ roomId, messageId }: { roomId: string; messageId: string }) => {
            // 🔴 SECURITY FIX: Block anonymous users
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            return chatsApi.deleteMessage(roomId, messageId);
        },
        onMutate: async ({ roomId, messageId }) => {
            if (!anonymousId) return { previousMessages: [] };
            await queryClient.cancelQueries({ queryKey: CHATS_KEYS.messages(roomId, anonymousId) });
            const previousMessages = queryClient.getQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId));

            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, anonymousId), (old) => {
                return old?.filter(m => m.id !== messageId) || [];
            });

            return { previousMessages };
        },
        onError: (_err, variables, context) => {
            if (context?.previousMessages && anonymousId) {
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId, anonymousId), context.previousMessages);
            }
        }
        // ✅ ENTERPRISE FIX: onSettled REMOVED for 0ms lag
        // SSE handles deletion sync across clients
    });
};

/**
 * 🆕 RETRY FEATURE: Reintentar mensajes fallidos
 * 
 * Permite al usuario reintentar enviar un mensaje que falló.
 * Reutiliza el mismo ID para mantener el orden y las referencias.
 */
export function useRetryMessageMutation() {
    const queryClient = useQueryClient();
    const toast = useToast();
    const { checkAuth } = useAuthGuard();

    return useMutation({
        mutationFn: async ({
            roomId,
            messageId,
            content,
            type,
            caption,
            replyToId
        }: {
            roomId: string;
            messageId: string;
            content: string;
            type?: 'text' | 'image' | 'sighting' | 'location';
            caption?: string;
            replyToId?: string;
        }) => {
            if (!checkAuth()) {
                throw new Error('AUTH_REQUIRED');
            }
            // Reuse the same ID for retry (idempotency)
            return chatsApi.sendMessage(roomId, content, type, caption, replyToId, messageId);
        },
        onMutate: async ({ roomId, messageId }) => {
            const senderId = sessionAuthority.getAnonymousId() || '';
            
            // Mark as pending again (show clock icon)
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(roomId, senderId), (old) => {
                if (!old) return old;
                return old.map(m => m.id === messageId 
                    ? { ...m, localStatus: 'pending' as const }
                    : m
                );
            });
        },
        onSuccess: (newMessage, variables) => {
            const currentId = sessionAuthority.getAnonymousId();
            if (!currentId) return;

            // Confirm the message
            chatCache.upsertMessage(queryClient, newMessage, currentId);
            chatCache.removePendingMessage(variables.roomId, newMessage.id);
            chatCache.applyInboxUpdate(queryClient, newMessage, currentId, true);
        },
        onError: (_err, variables) => {
            const senderId = sessionAuthority.getAnonymousId() || '';
            
            // Mark as failed again
            queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(variables.roomId, senderId), (old) => {
                if (!old) return old;
                return old.map(m => m.id === variables.messageId 
                    ? { ...m, localStatus: 'failed' as const }
                    : m
                );
            });

            toast.error('No se pudo reenviar. Intentá de nuevo.');
        }
    });
}
