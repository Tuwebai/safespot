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
            const actualPayload = payload.partial || payload;

            if (type === 'chat-update') {
                const convId = actualPayload.roomId;
                if (!convId) return;

                if (actualPayload.message) {
                    const message = actualPayload.message;
                    const isActiveRoom = window.location.pathname.endsWith(`/mensajes/${convId}`);
                    chatCache.applyInboxUpdate(queryClient, message, anonymousId, isActiveRoom);
                } else if (actualPayload.action === 'read') {
                    chatCache.markRoomAsRead(queryClient, convId, anonymousId);
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(m => m.sender_id !== anonymousId ? { ...m, is_read: true, is_delivered: true } : m);
                    });
                } else if (actualPayload.action === 'typing') {
                    queryClient.setQueryData(CHATS_KEYS.rooms(anonymousId), (old: any) => {
                        if (!old || !Array.isArray(old)) return old;
                        return old.map(r => r.id === convId ? { ...r, is_typing: actualPayload.isTyping } : r);
                    });
                }
            } else if (type === 'message.delivered') {
                const convId = actualPayload.conversationId;
                if (!convId) return;
                chatCache.applyDeliveryUpdate(queryClient, convId, anonymousId, actualPayload);
            } else if (type === 'message.read') {
                if (actualPayload.readerId !== anonymousId && actualPayload.roomId) {
                    chatCache.applyReadReceipt(queryClient, actualPayload.roomId, anonymousId);
                }
            } else if (type === 'chat-rollback') {
                if (actualPayload.roomId && actualPayload.messageId) {
                    queryClient.setQueryData<ChatMessage[]>(CHATS_KEYS.messages(actualPayload.roomId, anonymousId), (old) => {
                        if (!old) return old;
                        return old.filter(m => m.id !== actualPayload.messageId);
                    });
                }
            } else if (type === 'presence-update' || type === 'presence') {
                if (actualPayload.userId) {
                    queryClient.setQueryData<UserPresence>(CHATS_KEYS.presence(actualPayload.userId), actualPayload);
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
            // Orchestrator now normalizes payload to use 'partial' directly
            const actualPayload = payload;

            // Filter for THIS room
            const roomId = actualPayload.roomId || actualPayload.conversation_id || actualPayload.conversationId || actualPayload.conversation_id;
            if (roomId !== convId) return;

            // Echo suppression
            if (originClientId === getClientId()) return;

            switch (type) {
                case 'new-message':
                    chatCache.upsertMessage(queryClient, actualPayload, anonymousId);
                    if (actualPayload.sender_id !== anonymousId) {
                        playNotificationSound();
                    }
                    break;
                case 'typing':
                    if (actualPayload.senderId !== anonymousId) {
                        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                        setIsTyping(actualPayload.isTyping);
                        if (actualPayload.isTyping) {
                            typingTimeoutRef.current = setTimeout(() => setIsTyping(false), TYPING_TIMEOUT_MS);
                        }
                    }
                    break;
                case 'message.read':
                    if (actualPayload.readerId !== anonymousId) {
                        chatCache.applyReadReceipt(queryClient, convId, anonymousId);
                    }
                    break;
                case 'message.delivered':
                    chatCache.applyDeliveryUpdate(queryClient, convId, anonymousId, actualPayload);
                    break;
                case 'presence':
                    if (actualPayload.userId) {
                        queryClient.setQueryData(CHATS_KEYS.presence(actualPayload.userId), {
                            status: actualPayload.status,
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
                            return old.map(m => m.id === actualPayload.messageId ? { ...m, reactions: actualPayload.reactions } : m);
                        });
                    }
                    break;
                case 'message-pinned':
                    // Update cache... (logic same as before, but from actualPayload)
                    queryClient.setQueryData<ChatRoom[]>(CHATS_KEYS.rooms(anonymousId), (old) => {
                        if (!old) return old;
                        return old.map(r => r.id === convId ? { ...r, pinned_message_id: actualPayload.pinnedMessageId } : r);
                    });
                    queryClient.setQueryData<ChatRoom>(CHATS_KEYS.conversation(convId, anonymousId), (old) => {
                        if (!old) return old;
                        return { ...old, pinned_message_id: actualPayload.pinnedMessageId };
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

        onError: (err, variables, context) => {
            // ✅ ENTERPRISE FIX: IdentityNotReadyError no es un error de red
            // No hacer rollback porque no hubo optimistic update
            if (err instanceof IdentityNotReadyError || err instanceof IdentityInvariantViolation) {
                return; // Early return, no rollback necesario
            }

            // ✅ ENTERPRISE FIX: Offline Resilience
            // If network fails, the SW Background Sync has likely queued the request (Outbox).
            // We should NOT rollback the UI, but leave it as 'pending' (clock icon).
            const isNetworkError = !navigator.onLine || err.message === 'Failed to fetch' || (err as any).status === 0;

            if (isNetworkError) {
                // Optional: Update local status to 'failed' if different icon desired, 
                // but 'pending' (clock) is usually fine for "Waiting".
                return;
            }

            // Real Server Error (400/500) -> Rollback
            if (context?.previousMessages) {
                const rollbackId = sessionAuthority.getAnonymousId() || '';
                queryClient.setQueryData(CHATS_KEYS.messages(variables.roomId, rollbackId), context.previousMessages);
            }
            // ✅ PERSISTENCE: Cleanup invalid pending message (best effort)
            // Si no tenemos ID válido en variables, intentamos con tempId del contexto si existe
            const pendingId = variables.id;
            if (pendingId) {
                chatCache.removePendingMessage(variables.roomId, pendingId);
            }

            // Revocamos solo en error real
            if (context?.blobUrl) URL.revokeObjectURL(context.blobUrl);

            // Notificar al usuario del error y el rollback
            toast.error('Error enviando mensaje.');
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
